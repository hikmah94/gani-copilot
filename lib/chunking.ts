export type Chunk = { page: number | null; chunkIndex: number; text: string };

export function chunkPages(pages: { page: number; text: string }[], opts: { targetChars?: number; overlapChars?: number; maxChunks?: number } = {}): Chunk[] {
  const targetChars = opts.targetChars ?? 1000;
  const overlapChars = opts.overlapChars ?? 150;
  const maxChunks = opts.maxChunks ?? 800;
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    if (chunks.length >= maxChunks) break;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buffer = "";
    for (const paragraph of paragraphs) {
      if (buffer && (buffer.length + paragraph.length + 1) > targetChars) {
        chunks.push({ page, chunkIndex: chunkIndex++, text: buffer.trim() });
        if (chunks.length >= maxChunks) { buffer = ""; break; }
        buffer = buffer.slice(Math.max(0, buffer.length - overlapChars));
      }
      buffer = buffer ? `${buffer}\n${paragraph}` : paragraph;
    }
    if (buffer.trim() && chunks.length < maxChunks) chunks.push({ page, chunkIndex: chunkIndex++, text: buffer.trim() });
  }
  return chunks;
}
