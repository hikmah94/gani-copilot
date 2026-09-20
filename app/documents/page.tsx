import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileText, FolderSearch, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { DocumentCover } from "@/components/document-cover";
import { DocumentLibraryFilters } from "@/components/document-library-filters";
import { documentLibraryView } from "@/lib/document-library-view";
import { documentViewerSource } from "@/lib/document-file";
import { getDocumentFacets, searchDocuments } from "@/lib/repo-documents";

type Params = { q?: string; year?: string; government?: string; type?: string; authority?: string; status?: string };

export default async function Documents({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [facets, documents] = await Promise.all([
    getDocumentFacets(),
    searchDocuments({
      q: params.q?.trim() || undefined,
      year: params.year ? Number(params.year) : undefined,
      government: params.government || undefined,
      documentType: params.type || undefined,
      authority: params.authority || undefined,
      status: params.status || undefined,
    }),
  ]);
  const activeFilterCount = Object.values(params).filter(Boolean).length;

  return <Shell>
    <section className="page-hero documents-hero">
      <div className="documents-hero-copy">
        <span className="kicker">Niger State public records</span>
        <h1>Find the document. Read the record. Check the answer.</h1>
        <p>Browse the budget documents GANI uses to organise public information. Search by year, document type or issuing authority, then open a record to read the PDF here on GANI, search inside it and ask questions grounded in its pages.</p>
      </div>
      <aside className="documents-hero-note"><BookOpenCheck /><div><strong>Read without leaving GANI</strong><p>Every record with an attached file opens in GANI&apos;s own reader. Document questions use the passages indexed from that same file.</p></div></aside>
    </section>
    <section className="content documents-library">
      <DocumentLibraryFilters facets={facets} current={params} />
      <div className="document-results-head">
        <div><span className="kicker">Document library</span><h2>{documents.length} document{documents.length === 1 ? "" : "s"} found</h2><p>{activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "Showing all available public records"}</p></div>
        {activeFilterCount > 0 && <Link href="/documents" className="outline-button">Clear filters</Link>}
      </div>
      {documents.length ? <div className="document-library-grid">
        {documents.map((document) => {
          const view = documentLibraryView({ processingStatus: document.processing_status, projectCount: Number(document.project_count), pageCount: document.page_count });
          const readable = documentViewerSource({ id: document.id, r2_key: document.r2_key, original_url: document.original_url }).kind !== "none";
          return <article className="library-document-card" key={document.id}>
            <Link href={`/documents/${document.id}`} className="library-cover-link" aria-label={`Open ${document.title}`}>
              <DocumentCover id={document.id} title={document.title} year={document.year} type={document.document_type} />
              <span className="library-cover-year">{document.year}</span>
              <span className={`document-status library-cover-status ${view.statusTone}`}>{view.statusTone === "indexed" && <ShieldCheck size={13} />}{view.statusLabel}</span>
            </Link>
            <div className="document-card-copy"><span className="document-type">{document.document_type.replaceAll("_", " ")}</span><h3>{document.title}</h3><p>{document.issuing_authority}</p></div>
            <div className="document-card-meta"><div><small>Year</small><strong>{document.year}</strong></div><div><small>Government</small><strong>{document.government_name || "Niger State"}</strong></div></div>
            <div className="extraction-count"><FolderSearch size={18} /><div><strong>{view.projectLabel}</strong><small>{view.pageLabel}</small></div></div>
            <div className="document-card-actions">
              <Link className="button" href={`/documents/${document.id}`}>Open record <ArrowRight size={14} /></Link>
              {readable && <Link className="outline-button" href={`/documents/${document.id}#reader`}><FileText size={14} /> Read PDF</Link>}
            </div>
          </article>;
        })}
      </div> : <div className="panel empty-state-panel"><FolderSearch size={38} /><h2>No documents match these filters.</h2><p>Try a broader title, another year, or clear the filters.</p><Link href="/documents" className="button">Clear filters</Link></div>}
    </section>
  </Shell>;
}
