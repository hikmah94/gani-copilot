import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { ExplorerFilters } from "@/components/explorer-filters";
import { getExplorerFacets, searchExplorer, type ExplorerSort } from "@/lib/repo-budget-explorer";
import { formatMoney } from "@/lib/data";

const VALID_SORTS: ExplorerSort[] = ["allocation_desc", "allocation_asc", "name", "recent", "location"];

export default async function BudgetExplore({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const sort = VALID_SORTS.includes(params.sort as ExplorerSort) ? (params.sort as ExplorerSort) : "allocation_desc";
  const filters = {
    q: params.q?.trim() || undefined,
    year: params.year ? Number(params.year) : undefined,
    state: params.state || undefined,
    senatorialZone: params.zone || undefined,
    lga: params.lga || undefined,
    sector: params.sector || undefined,
    mda: params.mda || undefined,
    expenditureType: (params.type === "Capital" || params.type === "Recurrent") ? (params.type as "Capital" | "Recurrent") : undefined,
    status: params.status || undefined,
    minAllocation: params.min ? Number(params.min) : undefined,
    maxAllocation: params.max ? Number(params.max) : undefined,
    sort,
    page: params.page ? Number(params.page) : 1,
  };
  const [facets, result] = await Promise.all([getExplorerFacets(), searchExplorer(filters)]);

  const pageLink = (p: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") sp.set(key, value);
    sp.set("page", String(p));
    return `/budget/explore?${sp.toString()}`;
  };

  return <Shell>
    <section className="page-hero">
      <span className="kicker">Budget explorer</span>
      <h1>Interrogate the budget yourself.</h1>
      <p>Search and filter every verified project record without using AI. Every filter is reflected in the URL so results can be shared.</p>
    </section>
    <section className="content">
      <ExplorerFilters facets={facets} current={{ q: params.q, year: params.year, state: params.state, zone: params.zone, lga: params.lga, sector: params.sector, mda: params.mda, type: params.type, status: params.status, min: params.min, max: params.max, sort: params.sort }} />
      <div className="explorer-toolbar">
        <p className="result-count">{result.total} project{result.total === 1 ? "" : "s"} found</p>
      </div>

      {result.items.length ? <>
        <div className="explorer-table-wrap simple-table-wrap"><table className="simple-table"><thead><tr>
          <th>Project</th><th>Sector</th><th>LGA</th><th>MDA</th><th>Year</th><th>Status</th><th style={{ textAlign: "right" }}>Allocation</th>
        </tr></thead><tbody>
          {result.items.map((p) => <tr key={p.id}>
            <td><Link href={`/projects/${p.id}`}>{p.title}</Link></td>
            <td>{p.sector_name || "—"}</td>
            <td>{p.location_name || "—"}</td>
            <td>{p.mda_name || "—"}</td>
            <td>{p.budget_year}</td>
            <td><span className="verified">{p.verification_status}</span></td>
            <td style={{ textAlign: "right" }}>{formatMoney(p.approved_amount)}</td>
          </tr>)}
        </tbody></table></div>

        <div className="explorer-cards">
          {result.items.map((p) => <Link href={`/projects/${p.id}`} className="project-card" key={p.id}>
            <div><span className="tag">{p.sector_name || "Unclassified"}</span><h3>{p.title}</h3><p>{p.mda_name || "—"} · {p.location_name || "Statewide"} · {p.budget_year}</p><span className="verified"><ShieldCheck size={12} /> {p.verification_status}</span></div>
            <strong>{formatMoney(p.approved_amount)}</strong>
          </Link>)}
        </div>

        {result.totalPages > 1 && <div className="pagination">
          {result.page > 1 && <Link href={pageLink(result.page - 1)}><ArrowLeft size={14} /> Previous</Link>}
          <span>Page {result.page} of {result.totalPages}</span>
          {result.page < result.totalPages && <Link href={pageLink(result.page + 1)}>Next <ArrowRight size={14} /></Link>}
        </div>}
      </> : <div className="panel empty-state-panel">
        <ShieldAlert size={38} />
        <h2>No projects match the selected filters.</h2>
        <p>Try widening your search, or ask GANI to explain what you&apos;re looking for in plain language.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="outline-button" href="/budget/explore">Clear Filters</Link>
          <Link className="button" href={`/ask${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`}><Bot size={15} /> Ask GANI Instead</Link>
        </div>
      </div>}
    </section>
  </Shell>;
}
