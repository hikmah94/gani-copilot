import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [topRoutes, failedLogins, trackedRequests] = await env.DB.batch([
    env.DB.prepare("SELECT route, COUNT(*) as count FROM rate_limit_events WHERE created_at >= ?1 GROUP BY route ORDER BY count DESC LIMIT 10").bind(since),
    env.DB.prepare("SELECT actor, summary, created_at, ip_hash FROM admin_logs WHERE event_type='authentication' AND status='error' ORDER BY created_at DESC LIMIT 15"),
    env.DB.prepare("SELECT COUNT(*) as count FROM rate_limit_events WHERE created_at >= ?1").bind(since),
  ]);

  return Response.json({
    turnstileConfigured: Boolean(env.TURNSTILE_SITE_KEY),
    trackedRequests24h: Number((trackedRequests.results?.[0] as { count?: number } | undefined)?.count ?? 0),
    topRoutes: topRoutes.results ?? [],
    failedLogins: failedLogins.results ?? [],
  });
}
