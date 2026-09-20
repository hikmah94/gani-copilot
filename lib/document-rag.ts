export type DocumentMatch = { id: string; score?: number; metadata?: Record<string, unknown> };
export type DocumentChunk = { id: string; document_id: string; page: number | null; text: string };
export type ValidPassage = { id: string; page: number | null; text: string; score?: number };

export function normalizeDocumentQuestion(question: string): string {
  return question.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function validateDocumentPassages(matches: DocumentMatch[], rows: DocumentChunk[], documentId: string): ValidPassage[] {
  const byId = new Map(rows.filter(row => row.document_id === documentId && row.text.trim()).map(row => [row.id, row]));
  return matches.filter(match => match.metadata?.document_id === documentId).flatMap(match => {
    const row = byId.get(match.id);
    return row ? [{ id: row.id, page: row.page, text: row.text, score: match.score }] : [];
  });
}

type ModelAnswer = { answer?: unknown; summary?: unknown; facts?: unknown; limitations?: unknown; source_ids?: unknown };

export function parseDocumentAnswer(raw: string, passages: ValidPassage[], documentId: string, documentTitle: string) {
  let parsed: ModelAnswer;
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(trimmed) as ModelAnswer;
  } catch { throw new Error("Workers AI did not return a structured document answer."); }
  if (!parsed || typeof parsed.answer !== "string" || !parsed.answer.trim()) throw new Error("Workers AI did not return a structured document answer.");
  const allowed = new Map(passages.map(passage => [passage.id, passage]));
  const ids = Array.isArray(parsed.source_ids) ? parsed.source_ids.filter((id): id is string => typeof id === "string") : [];
  const sources = [...new Set(ids)].flatMap(id => {
    const passage = allowed.get(id);
    return passage ? [{ chunk_id: id, document_id: documentId, document_title: documentTitle, page: passage.page, snippet: passage.text.slice(0, 300), href: `/documents/${encodeURIComponent(documentId)}` }] : [];
  });
  const verified = sources.length > 0;
  const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  return {
    answer: verified ? parsed.answer.trim() : "I couldn't find a passage in this document that answers this. Try naming a ministry, programme, or page, or use Search inside to look through the text.",
    summary: verified && typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    facts: verified ? textList(parsed.facts) : [],
    calculations: [],
    projects: [],
    sources,
    confidence: verified ? "Medium" : "Unable to Verify",
    limitations: verified ? textList(parsed.limitations) : ["No valid passage references were returned."],
    suggested_followups: [],
  };
}

export type DocumentEvidence = { chunk_id: string; page: number | null; snippet: string; documentTitle: string; href: string; issuingAuthority?: string; year?: number; documentType?: string; sourceUrl?: string | null; indexedAt?: string | null };

export function documentEvidenceItems(evidence: DocumentEvidence[]) {
  return evidence.map(item => ({
    key: item.chunk_id,
    title: item.page ? `Page ${item.page}` : "Document excerpt",
    detail: item.snippet,
    passage: item.snippet,
    sourceType: "official-document",
    documentTitle: item.documentTitle,
    issuingAuthority: item.issuingAuthority,
    year: item.year,
    documentType: item.documentType,
    page: item.page,
    sourceUrl: item.sourceUrl ?? undefined,
    indexedAt: item.indexedAt ?? undefined,
    href: item.href,
  }));
}
