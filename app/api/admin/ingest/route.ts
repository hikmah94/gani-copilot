import { isAdmin } from "@/lib/admin-auth";
import { runIngestion } from "@/lib/ingest";

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { documentId } = await request.json() as { documentId?: string };
  if (!documentId) return Response.json({ error: "Document is required." }, { status: 400 });
  const result = await runIngestion(documentId);
  if (!result.ok) return Response.json({ error: result.error || "Ingestion failed." }, { status: 500 });
  return Response.json(result);
}
