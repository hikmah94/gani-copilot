import { listProjects } from "@/lib/repo-projects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const year = params.get("year");
  const { items, total } = await listProjects({
    sector: params.get("sector") || undefined,
    mda: params.get("mda") || undefined,
    location: params.get("location") || undefined,
    year: year ? Number(year) : undefined,
    q: params.get("q") || undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    offset: params.get("offset") ? Number(params.get("offset")) : undefined,
  });
  return Response.json({ items, total });
}
