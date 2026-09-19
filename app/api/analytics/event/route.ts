import { trackEvent, type AnalyticsEventType } from "@/lib/analytics";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED: AnalyticsEventType[] = ["evidence_opened", "filter_applied"];

export async function POST(request: Request) {
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("analytics_event", ipHash, 60, 60);
  if (!limit.allowed) return new Response(null, { status: 429 });
  try {
    const body = await request.json() as { eventType?: string; properties?: Record<string, unknown> };
    if (!body.eventType || !ALLOWED.includes(body.eventType as AnalyticsEventType)) return new Response(null, { status: 400 });
    await trackEvent(body.eventType as AnalyticsEventType, body.properties);
  } catch {
    // best-effort only — never fail hard on a malformed beacon payload
  }
  return new Response(null, { status: 204 });
}
