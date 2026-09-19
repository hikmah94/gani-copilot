import { env } from "cloudflare:workers";
import { extractDocumentPages } from "./pdf-extract";
import { chunkPages } from "./chunking";

export type IngestResult = { ok: boolean; chunks: number; pages: number; error?: string };

export async function runIngestion(documentId: string): Promise<IngestResult> {
  const jobId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO ingestion_jobs (id,document_id,job_type,status,detail) VALUES (?1,?2,'text_extraction','running','Extracting text from source PDF')").bind(jobId, documentId).run();
  try {
    const doc = await env.DB.prepare("SELECT id,r2_key,title FROM documents WHERE id=?1").bind(documentId).first<{ id: string; r2_key: string | null; title: string }>();
    if (!doc) throw new Error("Document not found");
    if (!doc.r2_key) throw new Error("Document has no stored file to extract");
    const object = await env.DOCUMENTS.get(doc.r2_key);
    if (!object) throw new Error("Source file is missing from storage");
    const buffer = await object.arrayBuffer();
    const pages = await extractDocumentPages(buffer);
    if (!pages.length) throw new Error("No extractable text found (the file may be a scanned image without a text layer)");
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error("Text was extracted but produced no usable chunks");

    await env.DB.prepare("DELETE FROM document_chunks WHERE document_id=?1").bind(documentId).run();
    const insertStatement = env.DB.prepare("INSERT INTO document_chunks (id,document_id,page,chunk_index,text,char_count) VALUES (?1,?2,?3,?4,?5,?6)");
    const bound = chunks.map((chunk) => insertStatement.bind(crypto.randomUUID(), documentId, chunk.page, chunk.chunkIndex, chunk.text, chunk.text.length));
    for (let i = 0; i < bound.length; i += 50) await env.DB.batch(bound.slice(i, i + 50));

    const distinctPages = new Set(pages.map((p) => p.page)).size;
    await env.DB.batch([
      env.DB.prepare("UPDATE documents SET processing_status='ready', page_count=?1, indexed_at=CURRENT_TIMESTAMP WHERE id=?2").bind(distinctPages, documentId),
      env.DB.prepare("UPDATE ingestion_jobs SET status='completed', detail=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(`Extracted ${distinctPages} pages into ${chunks.length} chunks`, jobId),
      env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary) VALUES (?1,'ingestion','system',?2)").bind(crypto.randomUUID(), `Indexed "${doc.title}" — ${chunks.length} chunks from ${distinctPages} pages`),
    ]);
    return { ok: true, chunks: chunks.length, pages: distinctPages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    await env.DB.batch([
      env.DB.prepare("UPDATE documents SET processing_status='failed' WHERE id=?1").bind(documentId),
      env.DB.prepare("UPDATE ingestion_jobs SET status='failed', detail=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(message, jobId),
      env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status) VALUES (?1,'ingestion','system',?2,'error')").bind(crypto.randomUUID(), `Failed to index document ${documentId}: ${message}`),
    ]);
    return { ok: false, chunks: 0, pages: 0, error: message };
  }
}
