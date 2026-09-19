import Link from "next/link";
import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { ProjectExplorerFilters } from "@/components/project-explorer-filters";
import { getExplorerFacets, searchExplorer, type ExplorerSort } from "@/lib/repo-budget-explorer";
import { formatMoney } from "@/lib/data";
import { locationLabel } from "@/lib/location-label";

const VALID_SORTS: ExplorerSort[] = ["allocation_desc", "allocation_asc", "name", "recent", "location"];
const boolParam = (v?: string) => v === "yes" ? true : v === "no" ? false : undefined;

export default async function Projects({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const sort = VALID_SORTS.includes(params.sort as ExplorerSort) ? (params.sort as ExplorerSort) : "allocation_desc";
  const filters = {
    q: params.q?.trim() || undefined,
    year: params.year ? Number(params.year) : undefined,
    state: params.state || undefined,
    senatorialZone: params.zone || undefined,
    lga: params.location || undefined,
    sector: params.sector || undefined,
    mda: params.mda || undefined,
    expenditureType: (params.type === "Capital" || params.type === "Recurrent") ? (params.type as "Capital" | "Recurrent") : undefined,
    status: params.status || undefined,
    minAllocation: params.min ? Number(params.min) : undefined,
    maxAllocation: params.max ? Number(params.max) : undefined,
    verificationStatus: params.verification || undefined,
    hasCommunityObservation: boolParam(params.observed),
    hasReleasedAmount: boolParam(params.released),
    hasContractor: boolParam(params.contractor),
    sort,
    page: params.page ? Number(params.page) : 1,
    pageSize: 30,
  };

  const [facets, result] = await Promise.all([getExplorerFacets(), searchExplorer(filters)]);

  const pageLink = (p: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") sp.set(key, value);
    sp.set("page", String(p));
    return `/projects?${sp.toString()}`;
  };

  return <Shell>
    <section className="page-hero">
      <span className="kicker">Project explorer</span>
      <h1>Verified public projects.</h1>
      <p>Every project here is traceable to a source document, page and reference. Search by name, location, sector, MDA or project code, or use the advanced filters below.</p>
    </section>
    <section className="content">
      <ProjectExplorerFilters facets={facets} current={{ q: params.q, year: params.year, state: params.state, zone: params.zone, lga: params.location, sector: params.sector, mda: params.mda, type: params.type, status: params.status, min: params.min, max: params.max, sort: params.sort, verification: params.verification, observed: params.observed, released: params.released, contractor: params.contractor }} />
      <p className="result-count">{result.total} project{result.total === 1 ? "" : "s"} found</p>
      {result.items.length ? <>
        <div className="project-list">
          {result.items.map((p) => <Link href={`/projects/${p.id}`} className="project-card" key={p.id}>
            <div>
              <h3>{p.title}</h3>
              <p>{p.sector_name || "Unclassified"} · {locationLabel(p.location_name)}</p>
              <p className="meta">{p.mda_name || "—"}</p>
              {p.verification_status === "verified" && <span className="verified"><ShieldCheck size={12} /> Verified Public Record</span>}
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>{formatMoney(p.approved_amount)}</strong>
              <small style={{ display: "block", marginTop: 6, color: "var(--green)", fontWeight: 750 }}>View Project →</small>
            </div>
          </Link>)}
        </div>
        {result.totalPages > 1 && <div className="pagination">
          {result.page > 1 && <Link href={pageLink(result.page - 1)}>Previous</Link>}
          <span>Page {result.page} of {result.totalPages}</span>
          {result.page < result.totalPages && <Link href={pageLink(result.page + 1)}>Next</Link>}
        </div>}
      </> : <div className="panel empty-state-panel">
        <ShieldAlert size={38} />
        <h2>No projects match these filters</h2>
        <p>GANI will not publish invented projects, allocations, locations or source references. Try widening your filters, or explore the verified annual approved-budget series instead.</p>
        <Link className="button" href="/budget">View nine-year budgets <ArrowRight size={16} /></Link>
      </div>}
    </section>
  </Shell>;
}
