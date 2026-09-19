"use client";

import Link from "next/link";
import { Building2, FileCheck2, FolderKanban, Layers3, MapPin, ScrollText, Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { searchGroupCounts } from "@/lib/search-utils";
import type { SearchResult, SearchResults as Results } from "@/lib/repo-search";

type GroupKey = "projects" | "documents" | "mdas" | "locations" | "sectors" | "passages";
const groups = [
  { key: "projects", title: "Projects", icon: FolderKanban },
  { key: "documents", title: "Documents", icon: FileCheck2 },
  { key: "mdas", title: "MDAs", icon: Building2 },
  { key: "locations", title: "Locations", icon: MapPin },
  { key: "sectors", title: "Sectors", icon: Layers3 },
  { key: "passages", title: "Document passages", icon: ScrollText },
] as const satisfies ReadonlyArray<{ key: GroupKey; title: string; icon: typeof FolderKanban }>;

function ResultCard({ result }: { result: SearchResult }) {
  return <Link href={result.href} className="project-card" style={{ display: "block" }}>
    <div>
      {result.meta && <span className="kicker">{result.meta}</span>}
      <h3>{result.title}</h3>
      <p>{result.snippet}</p>
    </div>
  </Link>;
}

export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") || "";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(query: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as Results & { error?: string };
      if (!response.ok) throw new Error(data.error || "Search is temporarily unavailable.");
      setResults(data);
    } catch (caught) {
      setResults(null);
      setError(caught instanceof Error ? caught.message : "Search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQ(initial);
    if (initial) void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.replace(`/search?q=${encodeURIComponent(query)}`);
    if (query === initial) void run(query);
  }

  const counts = results ? searchGroupCounts(results) : null;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0;

  return <section className="content" style={{ paddingTop: 40, maxWidth: 880 }}>
    <span className="kicker">Unified search</span>
    <h1 className="detail-title" style={{ fontSize: 36 }}>Find the public record.</h1>
    <p className="meta">Search projects, official documents, ministries, locations and sectors—no chat required.</p>
    <form onSubmit={submit} className="ask-box" style={{ margin: "20px 0" }}>
      <SearchIcon size={18} />
      <input value={q} onChange={event => setQ(event.target.value)} maxLength={160} aria-label="Search public records" placeholder="Try Bida hospital, Ministry of Health, or ICT…" />
      <button type="submit" disabled={loading}>Search</button>
    </form>
    {loading && <p className="meta" role="status">Searching public records…</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {results && counts && <>
      <p className="result-count">{total} displayed result{total === 1 ? "" : "s"}</p>
      <div className="search-category-counts" aria-label="Results by category" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0 26px" }}>
        {groups.map(group => <a key={group.key} href={`#results-${group.key}`} className="outline-button" style={{ fontSize: 13 }}>{group.title} {counts[group.key]}</a>)}
      </div>
      {results.mode === "semantic" && <p className="meta">No exact or partial matches. Showing related document passages.</p>}
      {results.semanticUnavailable && <p className="notice">Semantic passage search is temporarily unavailable; structured results are shown.</p>}
      {groups.map(group => {
        const items = results[group.key];
        if (!items.length) return null;
        const Icon = group.icon;
        return <section id={`results-${group.key}`} key={group.key} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Icon size={18} /> {group.title} <span className="meta">{items.length}</span></h2>
          <div className="project-list" style={{ marginTop: 10 }}>
            {items.map(result => <ResultCard key={`${result.kind}-${result.id}`} result={result} />)}
          </div>
        </section>;
      })}
      {total === 0 && <p className="meta">No records found. Try fewer words or a different spelling.</p>}
    </>}
  </section>;
}
