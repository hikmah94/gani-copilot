import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [totals, todayTotals, byType, recent] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, AVG(latency_ms) as avg_latency FROM ai_usage_events"),
    env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors FROM ai_usage_events WHERE created_at >= ?1").bind(since),
    env.DB.prepare("SELECT query_type, COUNT(*) as count FROM ai_usage_events GROUP BY query_type"),
    env.DB.prepare("SELECT created_at, provider, model, query_type, status, latency_ms, evidence_count FROM ai_usage_events ORDER BY created_at DESC LIMIT 25"),
  ]);

  const totalsRow = (totals.results?.[0] ?? {}) as { total?: number; errors?: number; avg_latency?: number };
  const todayRow = (todayTotals.results?.[0] ?? {}) as { total?: number; errors?: number };

  return Response.json({
    totalRequests: Number(totalsRow.total ?? 0),
    totalErrors: Number(totalsRow.errors ?? 0),
    avgLatencyMs: totalsRow.avg_latency ? Math.round(Number(totalsRow.avg_latency)) : null,
    requestsToday: Number(todayRow.total ?? 0),
    errorsToday: Number(todayRow.errors ?? 0),
    byType: byType.results ?? [],
    recent: recent.results ?? [],
  });
}
