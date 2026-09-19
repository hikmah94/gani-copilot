import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

type HealthStatus = "operational" | "degraded" | "not_configured";
type HealthCheck = { name: string; status: HealthStatus; detail: string };

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const checks: HealthCheck[] = [];

  const d1Start = Date.now();
  try {
    await env.DB.prepare("SELECT 1").first();
    checks.push({ name: "D1 database", status: "operational", detail: `Responded in ${Date.now() - d1Start}ms` });
  } catch (error) {
    checks.push({ name: "D1 database", status: "degraded", detail: error instanceof Error ? error.message : "Query failed" });
  }

  const r2Start = Date.now();
  try {
    await env.DOCUMENTS.list({ limit: 1 });
    checks.push({ name: "R2 storage", status: "operational", detail: `Responded in ${Date.now() - r2Start}ms` });
  } catch (error) {
    checks.push({ name: "R2 storage", status: "degraded", detail: error instanceof Error ? error.message : "List failed" });
  }

  const recentAi = await env.DB.prepare("SELECT status, latency_ms FROM ai_usage_events ORDER BY created_at DESC LIMIT 1").first<{ status: string; latency_ms: number | null }>();
  checks.push({
    name: "Workers AI",
    status: recentAi ? (recentAi.status === "success" ? "operational" : "degraded") : "operational",
    detail: recentAi ? `Last request ${recentAi.status}${recentAi.latency_ms ? ` in ${recentAi.latency_ms}ms` : ""}` : "No recent requests recorded",
  });

  checks.push({ name: "Vectorize", status: "not_configured", detail: "No binding configured in this deployment" });
  checks.push({ name: "AI Gateway", status: "not_configured", detail: "No binding configured in this deployment" });
  checks.push({ name: "Queues", status: "not_configured", detail: "No binding configured in this deployment" });

  const [backlog, failedJobs] = await env.DB.batch<{ count: number }>([
    env.DB.prepare("SELECT COUNT(*) as count FROM ingestion_jobs WHERE status IN ('queued','running')"),
    env.DB.prepare("SELECT COUNT(*) as count FROM ingestion_jobs WHERE status='failed'"),
  ]);

  return Response.json({
    checks,
    ingestionBacklog: Number(backlog.results?.[0]?.count ?? 0),
    ingestionFailed: Number(failedJobs.results?.[0]?.count ?? 0),
  });
}
