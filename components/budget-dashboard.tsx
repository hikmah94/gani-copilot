import Link from "next/link";
import { Bot } from "lucide-react";
import { formatMoney } from "@/lib/data";
import { getBudgetSummary, getCapitalRecurrentSplit, getGovernmentName, getLargestProjects, getLocationAllocations, getSectorAllocations } from "@/lib/repo-overview";

export async function BudgetDashboard({ year, availableYears }: { year: number; availableYears: number[] }) {
  const [summary, sectors, split, largest, locations, government] = await Promise.all([
    getBudgetSummary(year),
    getSectorAllocations(year),
    getCapitalRecurrentSplit(year),
    getLargestProjects(year, 10),
    getLocationAllocations(year, 10),
    getGovernmentName(),
  ]);
  const capital = summary.capitalExpenditure > 0 ? summary.capitalExpenditure : split.capital;
  const recurrent = summary.recurrentExpenditure > 0 ? summary.recurrentExpenditure : split.recurrent;

  return <>
    <div className="section-head" style={{ marginTop: 40 }}>
      <div><span className="kicker">Budget intelligence dashboard</span><h2 style={{ fontSize: 28 }}>{government} · {year}</h2><p>A single-year breakdown of analysed spending, queried live from the operational database.</p></div>
      <Link href={`/ask?q=${encodeURIComponent(`Tell me about the ${year} approved budget`)}`} className="button"><Bot size={16} /> Ask GANI about this budget</Link>
    </div>

    <div className="prompt-row" style={{ justifyContent: "flex-start", margin: "0 0 22px" }}>
      {availableYears.map((y) => <Link key={y} href={`/budget/${y}`} style={y === year ? { borderColor: "var(--green)", color: "var(--green)", fontWeight: 800 } : undefined}>{y}</Link>)}
    </div>

    <div className="metric-grid">
      <article className="metric featured"><small>Total budget</small><strong>{formatMoney(summary.analysedBudget)}</strong><span>{year} approved appropriation</span></article>
      <article className="metric"><small>Capital expenditure</small><strong>{formatMoney(capital)}</strong><span>{split.capitalPercent}% of analysed projects</span></article>
      <article className="metric"><small>Recurrent expenditure</small><strong>{formatMoney(recurrent)}</strong><span>{split.recurrentPercent}% of analysed projects</span></article>
      <Link href={`/projects?year=${year}`} className="metric"><small>Projects identified</small><strong>{summary.projectCount}</strong><span>Explore projects →</span></Link>
      <Link href={`/projects?year=${year}`} className="metric"><small>MDAs</small><strong>{summary.mdaCount}</strong><span>Ministries &amp; agencies</span></Link>
      <Link href={`/projects?year=${year}`} className="metric"><small>Sectors</small><strong>{summary.sectorCount}</strong><span>Classified sectors</span></Link>
      <Link href={`/projects?year=${year}`} className="metric"><small>Locations represented</small><strong>{summary.locationCount}</strong><span>LGAs with projects</span></Link>
    </div>

    <div className="panel" style={{ marginTop: 20 }}>
      <span className="kicker">Spending by sector</span><h3 style={{ fontSize: 20, margin: "8px 0 18px" }}>Analysed allocation by sector</h3>
      {sectors.length ? <div className="bars">
        {sectors.map((s) => <div key={s.slug}>
          <div className="bar-label"><span>{s.name} · {s.projectCount} project{s.projectCount === 1 ? "" : "s"}</span><strong>{formatMoney(s.totalAllocation)} · {s.percentage}%</strong></div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${s.percentage}%` }} /></div>
        </div>)}
      </div> : <p className="meta">No sector-classified projects have been imported for {year} yet.</p>}
    </div>

    <div className="panel" style={{ marginTop: 20 }}>
      <span className="kicker">Capital vs recurrent</span><h3 style={{ fontSize: 20, margin: "8px 0 18px" }}>How the analysed budget is split</h3>
      {(split.capital + split.recurrent) > 0 ? <div className="bars">
        <div><div className="bar-label"><span>Capital</span><strong>{split.capitalPercent}%</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${split.capitalPercent}%` }} /></div></div>
        <div><div className="bar-label"><span>Recurrent</span><strong>{split.recurrentPercent}%</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${split.recurrentPercent}%`, background: "var(--amber)" }} /></div></div>
      </div> : <p className="meta">No classified projects available yet to calculate a capital/recurrent split for {year}.</p>}
    </div>

    <div className="panel" style={{ marginTop: 20 }}>
      <span className="kicker">Largest projects</span><h3 style={{ fontSize: 20, margin: "8px 0 18px" }}>Ranked by approved amount</h3>
      {largest.length ? <div className="project-list">
        {largest.map((p) => <Link href={`/projects/${p.id}`} className="project-card" key={p.id}>
          <div><h3>{p.title}</h3><p>{p.mda_name || "—"} · {p.location_name || "Statewide"} · {p.sector_name || "Unclassified"}</p></div>
          <strong>{formatMoney(p.approved_amount)}</strong>
        </Link>)}
      </div> : <p className="meta">No projects have been imported for {year} yet.</p>}
    </div>

    <div className="panel" style={{ marginTop: 20 }}>
      <span className="kicker">Projects by location</span><h3 style={{ fontSize: 20, margin: "8px 0 18px" }}>Allocation by LGA</h3>
      {locations.length ? <div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>LGA</th><th style={{ textAlign: "right" }}>Projects</th><th style={{ textAlign: "right" }}>Allocation</th></tr></thead><tbody>
        {locations.map((l) => <tr key={l.id}><td><Link href={`/projects?location=${l.id}`}>{l.name}</Link></td><td style={{ textAlign: "right" }}>{l.projectCount}</td><td style={{ textAlign: "right" }}>{formatMoney(l.totalAllocation)}</td></tr>)}
      </tbody></table></div> : <p className="meta">No location-tagged projects have been imported for {year} yet.</p>}
    </div>
  </>;
}
