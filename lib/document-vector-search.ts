type Match = { id: string; score?: number; metadata?: Record<string, unknown> };
type VectorIndex = { query: (vector: number[], options: { topK: number; namespace: string; filter: { document_id: string }; returnMetadata: "indexed" }) => Promise<{ matches: Match[] }> };

export function documentVectorMetadata(documentId: string, page: number | null) {
  return { document_id: documentId, page: page ?? 0 };
}

export async function scopedDocumentMatches(vectorize: VectorIndex, vector: number[], documentId: string): Promise<Match[]> {
  if (!documentId.trim()) throw new Error("A document is required for scoped search.");
  const result = await vectorize.query(vector, {
    topK: 8,
    namespace: "niger-state",
    filter: { document_id: documentId },
    returnMetadata: "indexed",
  });
  return result.matches;
}
