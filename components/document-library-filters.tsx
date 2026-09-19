"use client";

import { Search } from "lucide-react";
import type { DocumentFacets } from "@/lib/repo-documents";

type Current = { q?: string; year?: string; government?: string; type?: string; authority?: string; status?: string };

export function DocumentLibraryFilters({ facets, current }: { facets: DocumentFacets; current: Current }) {
  return <form className="document-filters" action="/documents" method="get" onChange={(event) => {
    if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
  }}>
    <div className="document-search-field"><Search size={18} /><input name="q" defaultValue={current.q} placeholder="Search document title or issuing authority" aria-label="Search document title or issuing authority" /><button type="submit">Search records</button></div>
    <div className="document-filter-row">
      <label className="document-filter-field"><span>Year</span><select name="year" defaultValue={current.year || ""}><option value="">All years</option>{facets.years.map((year) => <option key={year}>{year}</option>)}</select></label>
      <label className="document-filter-field"><span>Government</span><select name="government" defaultValue={current.government || ""}><option value="">All governments</option>{facets.governments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label className="document-filter-field"><span>Document type</span><select name="type" defaultValue={current.type || ""}><option value="">All types</option>{facets.documentTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="document-filter-field"><span>Issuing authority</span><select name="authority" defaultValue={current.authority || ""}><option value="">All authorities</option>{facets.authorities.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="document-filter-field"><span>Record status</span><select name="status" defaultValue={current.status || ""}><option value="">All statuses</option>{facets.statuses.map((item) => <option key={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
    </div>
  </form>;
}
