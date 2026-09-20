import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Download, FileCheck2, FileText, Layers3, LibraryBig, Search, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { DocumentAsk } from "@/components/document-ask";
import { DocumentCover } from "@/components/document-cover";
import { DocumentExcerptSearch } from "@/components/document-excerpt-search";
import { PdfReader } from "@/components/pdf-reader";
import { documentDetailView } from "@/lib/document-detail-view";
import { getDocumentById, getDocumentChunksPreview } from "@/lib/repo-documents";
import { excerptSnippet } from "@/lib/document-excerpts";
import { trackEvent } from "@/lib/analytics";

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();
  const view = documentDetailView(doc);
  const preview = view.canAsk ? await getDocumentChunksPreview(id, 3) : [];
  const initialExcerpts = preview.map((chunk, index) => ({ id: `opening-${index}`, page: chunk.page, snippet: excerptSnippet(chunk.text, [], 260) }));
  const viewerHref = view.viewer.href;
  void trackEvent("document_viewed", { documentId: id });

  return (
    <Shell>
      <section className="content document-detail">
        <Link href="/documents" className="back"><ArrowLeft size={15} /> Back to documents</Link>

        <div className="document-detail-hero">
          <div className="document-detail-heading">
            <span className="document-detail-icon"><FileCheck2 size={27} /></span>
            <div>
              <span className="kicker">Official public record · {view.year}</span>
              <h1>{view.title}</h1>
              <p>{view.issuingAuthority}</p>
            </div>
          </div>
          <span className="verified"><ShieldCheck size={14} />{view.canAsk ? "Indexed record" : doc.processing_status.replaceAll("_", " ")}</span>
        </div>

        <div className="document-detail-actions">
          {viewerHref ? <a className="button" href="#reader"><FileText size={15} /> Read the PDF</a> : <span className="document-action-unavailable">No PDF file is attached to this record yet</span>}
          {view.downloadHref && <a className="outline-button" href={view.downloadHref}><Download size={15} /> Download PDF</a>}
          {view.canAsk && <a className="outline-button" href="#excerpts"><Search size={15} /> Search inside</a>}
          {view.canAsk && <a className="outline-button" href="#ask-this-document"><Bot size={15} /> Ask this document</a>}
        </div>

        <div className="reader-workspace">
          <div className="reader-main">
            {viewerHref ? (
              <PdfReader href={viewerHref} downloadHref={view.downloadHref ?? viewerHref} title={view.title} pageCount={doc.page_count} />
            ) : (
              <div className="reader-card reader-empty">
                <FileText size={34} />
                <h2>No PDF is attached to this record</h2>
                <p>GANI only opens documents it can show you here. This record has metadata but no readable file yet.</p>
              </div>
            )}
          </div>

          <aside className="reader-side">
            <div className="reader-side-card reader-side-cover">
              <DocumentCover id={doc.id} title={view.title} year={view.year} type={doc.document_type} size="side" />
            </div>
            <div className="reader-side-card">
              <h2 className="reader-side-title">About this record</h2>
              <dl className="reader-meta">
                <div><dt>Document type</dt><dd>{view.documentType}</dd></div>
                <div><dt>Government</dt><dd>{view.government}</dd></div>
                <div><dt>Year</dt><dd>{view.year}</dd></div>
                <div><dt>Issuing authority</dt><dd>{view.issuingAuthority}</dd></div>
                <div><dt>Published</dt><dd>{view.publicationDate}</dd></div>
                <div><dt>Indexed</dt><dd>{view.indexingDate}</dd></div>
                <div><dt>Pages</dt><dd>{typeof view.pageCount === "number" ? view.pageCount.toLocaleString() : view.pageCount}</dd></div>
                {view.publisher && <div><dt>Source host</dt><dd className="reader-host">{view.publisher}</dd></div>}
              </dl>
            </div>
            {view.extractions.length > 0 && (
              <div className="reader-side-card">
                <h2 className="reader-side-title"><Layers3 size={15} /> Extracted data</h2>
                <div className="reader-extracted">
                  {view.extractions.map((item) => (
                    <div key={item.label}><strong>{item.value.toLocaleString()}</strong><small>{item.label}</small></div>
                  ))}
                </div>
                <p className="reader-side-note">Counts are linked to this document&apos;s indexed project rows.</p>
              </div>
            )}
          </aside>
        </div>

        <section id="excerpts" className="document-content-section">
          <div className="document-section-title">
            <span><LibraryBig size={18} /> Inside this record</span>
            <p>{doc.chunk_count.toLocaleString()} searchable passage{doc.chunk_count === 1 ? "" : "s"}{doc.page_count ? ` across ${doc.page_count.toLocaleString()} pages` : ""}.</p>
          </div>
          <DocumentExcerptSearch documentId={doc.id} viewerHref={viewerHref} initial={initialExcerpts} canSearch={doc.chunk_count > 0} />
        </section>

        {view.canAsk ? (
          <section id="ask-this-document" className="document-ask-section">
            <DocumentAsk documentId={doc.id} documentTitle={doc.title} />
          </section>
        ) : (
          <div className="notice" style={{ marginTop: 22 }}>This document has not been indexed yet, so document-scoped Q&amp;A is unavailable.</div>
        )}
      </section>
    </Shell>
  );
}
