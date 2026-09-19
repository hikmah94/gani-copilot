import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const report = await env.DB.prepare("SELECT evidence_r2_key FROM community_reports WHERE id=?1").bind(id).first<{ evidence_r2_key: string | null }>();
  if (!report?.evidence_r2_key) return new Response("Not found", { status: 404 });
  const object = await env.DOCUMENTS.get(report.evidence_r2_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=300" } });
}
