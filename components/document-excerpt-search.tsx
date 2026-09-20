"use client";
import { CalendarDays, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { ReaderPageLink } from "@/components/reader-page-link";
import { highlightParts } from "@/lib/document-excerpts";

type Excerpt = { id?: string; page: number | null; snippet: string };

export function DocumentExcerptSearch({ documentId, viewerHref, initial, canSearch }: { documentId: string; viewerHref: string | null; initial: Excerpt[]; canSearch: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Excerpt[] | null>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) { setResults(null); setTokens([]); setError(""); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/excerpts?q=${encodeURIComponent(value)}`);
      const data = await response.json() as { tokens?: string[]; results?: Excerpt[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Search is unavailable right now.");
      setResults(data.results ?? []); setTokens(data.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  const shown = results ?? initial;
  return <div className="excerpt-search">
    {canSearch && <form className="excerpt-search-form" onSubmit={search} role="search">
      <Search size={16} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inside this document — e.g. health, Bida, borehole" aria-label="Search inside this document" maxLength={120} />
      <button className="button" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
    </form>}
    {error && <p className="notice">{error}</p>}
    <p className="excerpt-count">{results ? `${results.length} matching passage${results.length === 1 ? "" : "s"}${results.length === 8 ? " (showing the first 8)" : ""}` : initial.length ? "Opening passages" : ""}</p>
    {shown.length > 0 ? <div className="document-excerpts">
      {shown.map((item, index) => <blockquote key={item.id ?? index}>
        <small><CalendarDays size={13} /> {item.page ? `Page ${item.page}` : "Page unavailable"}</small>
        <p>{highlightParts(item.snippet, results ? tokens : []).map((part, i) => part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</p>
        <ReaderPageLink page={item.page} href={viewerHref} />
      </blockquote>)}
    </div> : results ? <div className="notice">No passages contain all of those words. Try fewer or simpler terms.</div> : <div className="notice">No searchable text is available for this document yet.</div>}
  </div>;
}
