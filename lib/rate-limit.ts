import { env } from "cloudflare:workers";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };

export async function checkRateLimit(route: string, ipHash: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const bucket = `${route}:${ipHash}:${windowStart}`;
  const row = await env.DB.prepare("SELECT COUNT(*) as count FROM rate_limit_events WHERE bucket=?1").bind(bucket).first<{ count: number }>();
  const count = Number(row?.count ?? 0);
  if (count >= limit) return { allowed: false, retryAfterSeconds: windowSeconds - (nowSeconds - windowStart) };
  await env.DB.prepare("INSERT INTO rate_limit_events (id,route,ip_hash,bucket) VALUES (?1,?2,?3,?4)").bind(crypto.randomUUID(), route, ipHash, bucket).run();
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("DELETE FROM rate_limit_events WHERE created_at < ?1").bind(cutoff).run().catch(() => {});
  }
  return { allowed: true };
}
