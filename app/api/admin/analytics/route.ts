import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [byType, evidenceOpened, questionsAsked] = await env.DB.batch([
    env.DB.prepare("SELECT event_type, COUNT(*) as count FROM analytics_events GROUP BY event_type ORDER BY count DESC"),
    env.DB.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE event_type='evidence_opened'"),
    env.DB.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE event_type='question_asked'"),
  ]);

  const opened = Number((evidenceOpened.results?.[0] as { count?: number } | undefined)?.count ?? 0);
  const asked = Number((questionsAsked.results?.[0] as { count?: number } | undefined)?.count ?? 0);

  return Response.json({
    byType: byType.results ?? [],
    evidenceOpenRate: asked > 0 ? Math.round((opened / asked) * 1000) / 10 : null,
  });
}
