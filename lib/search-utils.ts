export type SearchGroups = { projects: unknown[]; documents: unknown[]; passages: unknown[]; mdas: unknown[]; locations: unknown[]; sectors: unknown[] };

export function normalizeSearchQuery(query: string): string[] {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 160).split(" ").filter(Boolean).slice(0, 8);
}

export function buildSearchWhere(columns: string[], tokens: string[], mode: "all" | "any" = "all") {
  if (!columns.length || !tokens.length) return { clause: "0", params: [] as string[] };
  const params: string[] = [];
  const clause = tokens.map(token => {
    const like = `%${token.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(...columns.map(() => like));
    return `(${columns.map(column => `${column} LIKE ? ESCAPE '\\'`).join(" OR ")})`;
  }).join(mode === "all" ? " AND " : " OR ");
  return { clause, params };
}

export function shouldUseSemanticFallback(groups: SearchGroups): boolean {
  return Object.values(groups).every(items => items.length === 0);
}

export function searchGroupCounts(groups: SearchGroups) {
  return {
    projects: groups.projects.length,
    documents: groups.documents.length,
    passages: groups.passages.length,
    mdas: groups.mdas.length,
    locations: groups.locations.length,
    sectors: groups.sectors.length,
  };
}

export function buildDirectoryOrder(nameColumn: string, query: string) {
  return { clause: `CASE WHEN ${nameColumn} = ? COLLATE NOCASE THEN 0 ELSE 1 END, ${nameColumn}`, params: [query] };
}
