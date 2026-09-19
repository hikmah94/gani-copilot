import { env } from "cloudflare:workers";
import { searchDocumentPassages } from "@/lib/repo-analytics";
import { buildDirectoryOrder, buildSearchWhere, normalizeSearchQuery, shouldUseSemanticFallback } from "@/lib/search-utils";

export type SearchResult = { kind: "project" | "document" | "passage" | "mda" | "location" | "sector"; id: string; title: string; snippet: string; href: string; meta?: string };
export type SearchResults = { projects: SearchResult[]; documents: SearchResult[]; passages: SearchResult[]; mdas: SearchResult[]; locations: SearchResult[]; sectors: SearchResult[]; mode: "structured" | "semantic"; semanticUnavailable?: boolean };

type ProjectRow = { id: string; title: string; description: string | null; project_code: string; location_name: string | null; sector_name: string | null };
type DocumentRow = { id: string; title: string; document_type: string; year: number };
type PassageRow = { id: string; document_id: string; page: number | null; snippet: string; document_title: string; document_type: string; year: number };
type MdaRow = { id: string; name: string; type: string | null };
type LocationRow = { id: string; name: string; type: string; senatorial_zone: string | null };
type SectorRow = { id: string; name: string; slug: string; description: string | null };

export function emptySearchResults(): SearchResults {
  return { projects: [], documents: [], passages: [], mdas: [], locations: [], sectors: [], mode: "structured" };
}

export async function unifiedSearch(query: string, limit = 12): Promise<SearchResults> {
  const tokens = normalizeSearchQuery(query);
  if (!tokens.length) return emptySearchResults();
  const cleanQuery = tokens.join(" ");
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  const projectFilter = buildSearchWhere(["projects.title", "projects.description", "projects.project_code", "locations.name", "sectors.name", "mdas.name"], tokens);
  const documentFilter = buildSearchWhere(["documents.title", "documents.document_type", "documents.issuing_authority"], tokens);
  const mdaFilter = buildSearchWhere(["mdas.name", "mdas.type"], tokens, "any");
  const locationFilter = buildSearchWhere(["locations.name", "locations.type", "locations.senatorial_zone"], tokens, "any");
  const sectorFilter = buildSearchWhere(["sectors.name", "sectors.slug", "sectors.description"], tokens, "any");
  const mdaOrder = buildDirectoryOrder("mdas.name", cleanQuery);
  const locationOrder = buildDirectoryOrder("locations.name", cleanQuery);
  const sectorOrder = buildDirectoryOrder("sectors.name", cleanQuery);
  const ftsTerms = tokens.map(token => token.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  const ftsQuery = ftsTerms.length ? ftsTerms.map(token => `"${token}"*`).join(" ") : "zzzzzzzzzzzzzzzzzzzz";

  const [projectRows, documentRows, passageRows, mdaRows, locationRows, sectorRows] = await env.DB.batch([
    env.DB.prepare(`SELECT projects.id,projects.title,projects.description,projects.project_code,locations.name AS location_name,sectors.name AS sector_name FROM projects LEFT JOIN locations ON locations.id=projects.location_id LEFT JOIN sectors ON sectors.id=projects.sector_id LEFT JOIN mdas ON mdas.id=projects.mda_id WHERE ${projectFilter.clause} ORDER BY projects.budget_year DESC,projects.approved_amount DESC LIMIT ?`).bind(...projectFilter.params, boundedLimit),
    env.DB.prepare(`SELECT documents.id,documents.title,documents.document_type,documents.year FROM documents WHERE ${documentFilter.clause} ORDER BY documents.year DESC LIMIT ?`).bind(...documentFilter.params, boundedLimit),
    env.DB.prepare(`SELECT document_chunks.id,document_chunks.document_id,document_chunks.page,snippet(document_chunks_fts,0,'[',']','…',12) AS snippet,documents.title AS document_title,documents.document_type,documents.year FROM document_chunks_fts JOIN document_chunks ON document_chunks.rowid=document_chunks_fts.rowid JOIN documents ON documents.id=document_chunks.document_id WHERE document_chunks_fts MATCH ? LIMIT ?`).bind(ftsQuery, boundedLimit),
    env.DB.prepare(`SELECT mdas.id,mdas.name,mdas.type FROM mdas WHERE ${mdaFilter.clause} ORDER BY ${mdaOrder.clause} LIMIT ?`).bind(...mdaFilter.params, ...mdaOrder.params, boundedLimit),
    env.DB.prepare(`SELECT locations.id,locations.name,locations.type,locations.senatorial_zone FROM locations WHERE ${locationFilter.clause} ORDER BY ${locationOrder.clause} LIMIT ?`).bind(...locationFilter.params, ...locationOrder.params, boundedLimit),
    env.DB.prepare(`SELECT sectors.id,sectors.name,sectors.slug,sectors.description FROM sectors WHERE ${sectorFilter.clause} ORDER BY ${sectorOrder.clause} LIMIT ?`).bind(...sectorFilter.params, ...sectorOrder.params, boundedLimit),
  ]);

  const projects = ((projectRows.results ?? []) as ProjectRow[]).map((row): SearchResult => ({ kind: "project", id: row.id, title: row.title, snippet: [row.location_name, row.sector_name, row.description || row.project_code].filter(Boolean).join(" · "), href: `/projects/${encodeURIComponent(row.id)}` }));
  const documents = ((documentRows.results ?? []) as DocumentRow[]).map((row): SearchResult => ({ kind: "document", id: row.id, title: row.title, snippet: `${row.document_type} · ${row.year}`, href: `/documents/${encodeURIComponent(row.id)}`, meta: row.document_type }));
  const passages = ((passageRows.results ?? []) as PassageRow[]).map((row): SearchResult => ({ kind: "passage", id: row.id, title: row.document_title, snippet: row.snippet, href: `/documents/${encodeURIComponent(row.document_id)}`, meta: row.page ? `Page ${row.page}` : "Passage" }));
  const mdas = ((mdaRows.results ?? []) as MdaRow[]).map((row): SearchResult => ({ kind: "mda", id: row.id, title: row.name, snippet: row.type || "Ministry, department or agency", href: `/projects?mda=${encodeURIComponent(row.id)}` }));
  const locations = ((locationRows.results ?? []) as LocationRow[]).map((row): SearchResult => ({ kind: "location", id: row.id, title: row.name, snippet: [row.type, row.senatorial_zone].filter(Boolean).join(" · "), href: `/projects?location=${encodeURIComponent(row.id)}` }));
  const sectors = ((sectorRows.results ?? []) as SectorRow[]).map((row): SearchResult => ({ kind: "sector", id: row.id, title: row.name, snippet: row.description || "Budget sector", href: `/projects?sector=${encodeURIComponent(row.slug)}` }));
  const results: SearchResults = { projects, documents, passages, mdas, locations, sectors, mode: "structured" };
  for (const row of (passageRows.results ?? []) as PassageRow[]) {
    if (documents.some(document => document.id === row.document_id)) continue;
    documents.push({ kind: "document", id: row.document_id, title: row.document_title, snippet: `${row.document_type} · ${row.year} · matched passage`, href: `/documents/${encodeURIComponent(row.document_id)}`, meta: row.document_type });
  }

  if (!shouldUseSemanticFallback(results) || !/\p{L}|\p{N}/u.test(cleanQuery)) return results;
  try {
    const semantic = await searchDocumentPassages(cleanQuery, 6);
    const seen = new Set<string>();
    results.passages = semantic.filter(item => {
      const key = `${item.documentId}:${item.page}:${item.snippet}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item, index): SearchResult => ({ kind: "passage", id: `${item.documentId}-${item.page}-${index}`, title: item.documentTitle, snippet: item.snippet, href: `/documents/${encodeURIComponent(item.documentId)}`, meta: item.page ? `Page ${item.page} · semantic match` : "Semantic match" }));
    results.mode = "semantic";
  } catch (error) {
    console.error(JSON.stringify({ event: "semantic_search_failed", message: error instanceof Error ? error.message : "Unknown failure" }));
    results.semanticUnavailable = true;
  }
  return results;
}
