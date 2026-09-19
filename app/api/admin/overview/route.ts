import { env } from "cloudflare:workers";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const user = await getAdminSession(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [budgets, documents, projects, reports, sectors, mdas, locations, jobs, logs, metrics] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM budgets ORDER BY budget_year DESC LIMIT 25"),
    env.DB.prepare("SELECT * FROM documents ORDER BY year DESC LIMIT 25"),
    env.DB.prepare("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 25"),
    env.DB.prepare("SELECT * FROM community_reports ORDER BY submitted_at DESC LIMIT 25"),
    env.DB.prepare("SELECT * FROM sectors ORDER BY name LIMIT 100"),
    env.DB.prepare("SELECT * FROM mdas ORDER BY name LIMIT 100"),
    env.DB.prepare("SELECT * FROM locations ORDER BY name LIMIT 100"),
    env.DB.prepare("SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT 25"),
    env.DB.prepare("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 25"),
    env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM documents WHERE processing_status='ready') as documents_ready,
      (SELECT COUNT(*) FROM documents WHERE processing_status!='ready') as documents_pending,
      (SELECT COUNT(*) FROM community_reports WHERE moderation_status='pending') as reports_pending,
      (SELECT COUNT(*) FROM ai_usage_events WHERE date(created_at)=date('now')) as ai_requests_today,
      (SELECT COUNT(*) FROM ingestion_jobs WHERE status='failed') as ingestion_failed`),
  ]);
  return Response.json({
    user: { email: user.email, role: user.role },
    budgets: budgets.results, documents: documents.results, projects: projects.results, reports: reports.results,
    sectors: sectors.results, mdas: mdas.results, locations: locations.results, jobs: jobs.results, logs: logs.results,
    metrics: metrics.results?.[0] ?? {},
  });
}
