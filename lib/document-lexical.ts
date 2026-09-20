const STOPWORDS = new Set(["the", "and", "for", "are", "was", "were", "what", "which", "who", "whom", "how", "much", "many", "does", "did", "this", "that", "these", "those", "with", "from", "into", "about", "give", "tell", "show", "please", "document", "summarise", "summarize", "there", "their", "have", "has", "had", "any", "all", "its", "can", "you"]);

/** Builds a safe FTS5 MATCH expression (quoted terms joined by OR) from a natural-language question. */
export function ftsQuery(question: string): string | null {
  const words = question.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter((word) => word.length >= 3 && !STOPWORDS.has(word)))].slice(0, 8);
  return terms.length ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}

/** Vector matches stay first; lexical matches fill in passages the embedding missed (tables, exact terms). */
export function mergeMatches<T extends { id: string }>(vectorMatches: T[], lexicalIds: string[], documentId: string, limit = 12) {
  const seen = new Set(vectorMatches.map((match) => match.id));
  const extra = lexicalIds.filter((id) => !seen.has(id)).map((id) => ({ id, metadata: { document_id: documentId } }));
  return [...vectorMatches, ...extra].slice(0, limit) as Array<T | { id: string; metadata: { document_id: string } }>;
}
