const PEPPER = "gani-copilot-abuse-guard-v1";

export async function hashIp(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const bytes = new TextEncoder().encode(`${PEPPER}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
