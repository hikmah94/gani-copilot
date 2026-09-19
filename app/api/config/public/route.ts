import { env } from "cloudflare:workers";

export async function GET() {
  return Response.json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null });
}
