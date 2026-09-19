import { env } from "cloudflare:workers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await env.DB.prepare("SELECT r2_key, title FROM documents WHERE id=?1").bind(id).first<{ r2_key: string | null; title: string }>();
  if (!doc || !doc.r2_key) return new Response("Not found", { status: 404 });
  const object = await env.DOCUMENTS.get(doc.r2_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/pdf",
      "content-disposition": `inline; filename="${doc.title.replace(/[^a-zA-Z0-9 ._-]/g, "")}.pdf"`,
      "cache-control": "private, max-age=300",
    },
  });
}
