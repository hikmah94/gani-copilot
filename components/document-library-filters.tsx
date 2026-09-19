"use client";

import { Search } from "lucide-react";
import type { DocumentFacets } from "@/lib/repo-documents";

type Current = {
  q?: string;
  year?: string;
  government?: string;
  type?: string;
  authority?: string;
  status?: string;
};

export function DocumentLibraryFilters({
  facets,
  current,
}: {
  facets: DocumentFacets;
  current: Current;
}) {
  return (
    <form
      className="document-filters"
      action="/documents"
      method="get"
      onChange={(event) => {
        if ((event.target as HTMLElement).tagName === "SELECT")
          event.currentTarget.requestSubmit();
      }}
    >
      <div className="field search-field">
        <Search size={16} />
        <input
          name="q"
          defaultValue={current.q}
          placeholder="Search title, authority, year or document type…"
        />
        <button type="submit">Search</button>
      </div>
      <select className="field" name="year" defaultValue={current.year || ""}>
        <option value="">All years</option>
        {facets.years.map((year) => (
          <option key={year}>{year}</option>
        ))}
      </select>
      <select
        className="field"
        name="government"
        defaultValue={current.government || ""}
      >
        <option value="">All governments</option>
        {facets.governments.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <select className="field" name="type" defaultValue={current.type || ""}>
        <option value="">All document types</option>
        {facets.documentTypes.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <select
        className="field"
        name="authority"
        defaultValue={current.authority || ""}
      >
        <option value="">All issuing authorities</option>
        {facets.authorities.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <select
        className="field"
        name="status"
        defaultValue={current.status || ""}
      >
        <option value="">All indexing statuses</option>
        {facets.statuses.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </form>
  );
}
