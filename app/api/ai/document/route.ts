import { env } from "cloudflare:workers";
import { scopedDocumentMatches } from "@/lib/document-vector-search";
import { normalizeDocumentQuestion, parseDocumentAnswer, validateDocumentPassages, type DocumentChunk } from "@/lib/document-rag";
import { runAiModel } from "@/lib/ai-model";
import { recordAiUsage } from "@/lib/ai-telemetry";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

type DocumentChatRequest = { message?: string; documentId?: string; provider?: "cloudflare" | "ollama" };
type DocumentRow = { id: string; title: string; processing_status: string; document_type: string; year: number; issuing_authority: string; original_url: string | null; indexed_at: string | null };

export async function POST(request: Request) {
  const started = Date.now();
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("ai_document", ipHash, 20, 60);
  if (!limit.allowed) return Response.json({ error: "Too many requests. Please wait a moment before asking again." }, { status: 429 });

  try {
    const body = await request.json() as DocumentChatRequest;
    const message = normalizeDocumentQuestion(body.message || "");
    const documentId = body.documentId?.trim();
    if (!documentId) return Response.json({ error: "A document is required." }, { status: 400 });
    if (!message || message.length > 1000) return Response.json({ error: "Enter a question of 1–1,000 characters." }, { status: 400 });

    const doc = await env.DB.prepare("SELECT id,title,processing_status,document_type,year,issuing_authority,original_url,indexed_at FROM documents WHERE id=?1").bind(documentId).first<DocumentRow>();
    if (!doc) return Response.json({ error: "Document not found." }, { status: 404 });

    const embedded = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [message] }) as { data?: number[][] };
    const vector = embedded.data?.[0];
    if (!vector?.length) throw new Error("Unable to search this document right now.");
    const matches = await scopedDocumentMatches(env.VECTORIZE, vector, documentId);
    const ids = matches.map((match) => match.id);
    const rows = ids.length ? await env.DB.prepare(
      `SELECT id,document_id,page,text FROM document_chunks WHERE document_id=?1 AND id IN (${ids.map(() => "?").join(",")})`
    ).bind(documentId, ...ids).all<DocumentChunk>() : { results: [] as DocumentChunk[] };
    const matchedChunks = validateDocumentPassages(matches, rows.results ?? [], documentId);
    if (!matchedChunks.length) {
      void trackEvent("no_evidence_found", { documentId });
      return Response.json({ error: "No searchable passages are available for this document yet. Ask an administrator to index it for document Q&A." }, { status: 409 });
    }

    const systemPrompt = `You are GANI, a politically neutral public-accountability copilot for Niger State, Nigeria.
Answer only from the supplied excerpts of "${doc.title}". Never invent figures, projects, or claims not present in the excerpts.
Cite page numbers when available. Use plain English and keep the answer under 180 words. If the excerpts cannot answer the question, say so clearly. These are only the most relevant passages, not necessarily the whole document. Do not describe a list, ranking, total, or summary as exhaustive unless the excerpts explicitly establish that it is. Never use knowledge from another document.
Return ONLY valid JSON with keys answer (string), summary (string), facts (string array), limitations (string array), and source_ids (array of IDs from DOCUMENT EXCERPTS that directly support the answer). Do not cite an ID you did not use. If evidence is insufficient, say so in answer and use an empty source_ids array.

DOCUMENT EXCERPTS:
${JSON.stringify(matchedChunks)}`;

    const provider = body.provider === "ollama" ? "ollama" : "cloudflare";
    const result = await runAiModel(systemPrompt, message, provider);
    const structured = parseDocumentAnswer(result.answer, matchedChunks, documentId, doc.title);
    await recordAiUsage({ provider: result.provider, model: result.model, queryType: "document", documentId, status: "success", latencyMs: Date.now() - started, inputChars: message.length, outputChars: structured.answer.length, evidenceCount: structured.sources.length });
    return Response.json({ ...structured, provider: result.provider, model: result.model, evidence: structured.sources.map(source => ({ page: source.page, snippet: source.snippet, chunk_id: source.chunk_id, documentTitle: doc.title, issuingAuthority: doc.issuing_authority, year: doc.year, documentType: doc.document_type, sourceUrl: doc.original_url, indexedAt: doc.indexed_at, href: source.href })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI is temporarily unavailable.";
    console.error(JSON.stringify({ event: "ai_document_error", message }));
    await recordAiUsage({ provider: "cloudflare", model: env.AI_MODEL || "@cf/openai/gpt-oss-20b", queryType: "document", status: "error", latencyMs: Date.now() - started, errorMessage: message });
    void trackEvent("ai_error", { route: "document" });
    return Response.json({ error: message }, { status: 503 });
  }
}
