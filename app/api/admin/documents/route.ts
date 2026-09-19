import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";
import { runIngestion } from "@/lib/ingest";

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const year = Number(form.get("year"));
  if (!(file instanceof File) || !title || !Number.isInteger(year) || file.size > 25 * 1024 * 1024) return Response.json({ error: "Provide a title, valid year, and file up to 25 MB." }, { status: 400 });
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `public-records/${year}/${id}-${safeName}`;
  await env.DOCUMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { title, year: String(year) } });
  await env.DB.prepare("INSERT INTO documents (id,title,document_type,government_id,year,issuing_authority,r2_key,processing_status) VALUES (?1,?2,?3,'niger-state',?4,?5,?6,'uploaded')")
    .bind(id, title, String(form.get("documentType") || "Budget document"), year, String(form.get("authority") || "Niger State Government"), key).run();
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary) VALUES (?1,'document_upload','administrator',?2)").bind(crypto.randomUUID(), `Uploaded ${title}`).run();
  const ingestion = await runIngestion(id);
  return Response.json({ ok: true, id, ingestion });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { documentId } = await request.json() as { documentId?: string };
  if (!documentId) return Response.json({ error: "Document is required." }, { status: 400 });
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary) VALUES (?1,'reindex','administrator',?2)").bind(crypto.randomUUID(), `Requested re-index of document ${documentId}`).run();
  const result = await runIngestion(documentId);
  if (!result.ok) return Response.json({ error: result.error || "Ingestion failed." }, { status: 500 });
  return Response.json(result);
}
