import { emptySearchResults, unifiedSearch } from "@/lib/repo-search";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

export async function GET(request: Request) {
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("search", ipHash, 30, 60);
  if (!limit.allowed) return Response.json({ error: "Too many searches. Please slow down." }, { status: 429 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  if (!q) return Response.json(emptySearchResults());
  if (q.length > 160) return Response.json({ error: "Search terms must be 160 characters or fewer." }, { status: 400 });
  const results = await unifiedSearch(q);
  void trackEvent("search_performed", { q });
  return Response.json(results);
}
