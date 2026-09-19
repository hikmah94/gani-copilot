import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

type ProjectRow = { project_code?: string; title?: string; description?: string; budget_year?: number; approved_amount?: number; capital_or_recurrent?: string; source_reference?: string };

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { projects } = await request.json() as { projects?: ProjectRow[] };
  if (!Array.isArray(projects) || projects.length < 1 || projects.length > 500) return Response.json({ error: "Import 1–500 projects at a time." }, { status: 400 });
  const valid = projects.filter((row) => row.project_code && row.title && Number.isInteger(Number(row.budget_year)) && Number(row.approved_amount) >= 0 && ["Capital", "Recurrent"].includes(row.capital_or_recurrent || ""));
  if (valid.length !== projects.length) return Response.json({ error: "Every row needs project_code, title, budget_year, approved_amount, and Capital or Recurrent." }, { status: 400 });
  const statement = env.DB.prepare("INSERT INTO projects (id,project_code,title,description,budget_year,approved_amount,capital_or_recurrent,verification_status,source_reference) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8) ON CONFLICT(project_code) DO UPDATE SET title=excluded.title,description=excluded.description,budget_year=excluded.budget_year,approved_amount=excluded.approved_amount,capital_or_recurrent=excluded.capital_or_recurrent,source_reference=excluded.source_reference,updated_at=CURRENT_TIMESTAMP");
  await env.DB.batch(valid.map((row) => statement.bind(crypto.randomUUID(), row.project_code!, row.title!, row.description || null, Number(row.budget_year), Number(row.approved_amount), row.capital_or_recurrent!, row.source_reference || null)));
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary) VALUES (?1,'project_import','administrator',?2)").bind(crypto.randomUUID(), `Imported ${valid.length} project records`).run();
  return Response.json({ ok: true, imported: valid.length });
}

