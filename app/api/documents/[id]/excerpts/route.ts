import { env } from "cloudflare:workers";
import { excerptSnippet } from "@/lib/document-excerpts";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildSearchWhere, normalizeSearchQuery } from "@/lib/search-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokens = normalizeSearchQuery(new URL(request.url).searchParams.get("q") ?? "");
  if (!tokens.length) return Response.json({ tokens, results: [] });

  const limit = await checkRateLimit("document_excerpts", await hashIp(request), 40, 60);
  if (!limit.allowed) return Response.json({ error: "Too many searches. Please wait a moment." }, { status: 429 });

  const { clause, params: like } = buildSearchWhere(["document_chunks.text"], tokens, "all");
  const rows = await env.DB.prepare(
    `SELECT document_chunks.id, document_chunks.page, document_chunks.text FROM document_chunks WHERE document_chunks.document_id = ? AND (${clause}) ORDER BY document_chunks.page ASC, document_chunks.chunk_index ASC LIMIT 8`,
  ).bind(id, ...like).all<{ id: string; page: number | null; text: string }>();

  return Response.json({
    tokens,
    results: (rows.results ?? []).map((row) => ({ id: row.id, page: row.page, snippet: excerptSnippet(row.text, tokens) })),
  });
}
