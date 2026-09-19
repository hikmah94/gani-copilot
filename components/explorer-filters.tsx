"use client";
import { Search } from "lucide-react";
import type { ExplorerFacets } from "@/lib/repo-budget-explorer";

type Current = {
  q?: string; year?: string; state?: string; zone?: string; lga?: string; sector?: string; mda?: string;
  type?: string; status?: string; min?: string; max?: string; sort?: string;
};

export function ExplorerFilters({ facets, current }: { facets: ExplorerFacets; current: Current }) {
  return <form className="explorer-filters" action="/budget/explore" method="get" onChange={(e) => e.currentTarget.requestSubmit()}>
    <div className="field search-field" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 0 14px" }}>
      <Search size={15} color="#607168" />
      <input name="q" defaultValue={current.q} placeholder="Search projects, ministries, sectors or locations..." style={{ border: 0, outline: "none", padding: "12px 14px 12px 0", width: "100%", background: "transparent" }} />
    </div>
    <select className="field" name="year" defaultValue={current.year || ""}><option value="">All years</option>{facets.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
    <select className="field" defaultValue="Niger State" disabled aria-label="Government"><option>Niger State</option></select>
    <select className="field" name="state" defaultValue={current.state || ""}><option value="">All states</option>{facets.states.map((s) => <option key={s} value={s}>{s}</option>)}</select>
    <select className="field" name="zone" defaultValue={current.zone || ""}><option value="">All senatorial zones</option>{facets.senatorialZones.map((z) => <option key={z} value={z}>{z}</option>)}</select>
    <select className="field" name="lga" defaultValue={current.lga || ""}><option value="">All LGAs</option>{facets.lgas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    <select className="field" name="sector" defaultValue={current.sector || ""}><option value="">All sectors</option>{facets.sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select>
    <select className="field" name="mda" defaultValue={current.mda || ""}><option value="">All MDAs</option>{facets.mdas.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
    <select className="field" name="type" defaultValue={current.type || ""}><option value="">All expenditure types</option><option value="Capital">Capital</option><option value="Recurrent">Recurrent</option></select>
    <select className="field" name="status" defaultValue={current.status || ""}><option value="">All statuses</option>{facets.statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
    <input className="field" name="min" type="number" min={0} defaultValue={current.min} placeholder="Min allocation (₦)" />
    <input className="field" name="max" type="number" min={0} defaultValue={current.max} placeholder="Max allocation (₦)" />
    <select className="field" name="sort" defaultValue={current.sort || "allocation_desc"}>
      <option value="allocation_desc">Highest allocation</option>
      <option value="allocation_asc">Lowest allocation</option>
      <option value="name">Project name</option>
      <option value="recent">Most recent</option>
      <option value="location">Location</option>
    </select>
    <noscript><button className="button" type="submit">Apply filters</button></noscript>
  </form>;
}
