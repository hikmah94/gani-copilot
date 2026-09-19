import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  Layers3,
  LibraryBig,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { DocumentAsk } from "@/components/document-ask";
import { documentDetailView } from "@/lib/document-detail-view";
import {
  getDocumentById,
  getDocumentChunksPreview,
} from "@/lib/repo-documents";
import { trackEvent } from "@/lib/analytics";

export default async function DocumentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();
  const view = documentDetailView(doc);
  const preview = view.canAsk ? await getDocumentChunksPreview(id, 2) : [];
  void trackEvent("document_viewed", { documentId: id });

  return (
    <Shell>
      <section className="content document-detail">
        <Link href="/documents" className="back">
          <ArrowLeft size={15} /> Back to documents
        </Link>
        <div className="document-detail-hero">
          <div className="document-detail-heading">
            <span className="document-detail-icon">
              <FileCheck2 size={27} />
            </span>
            <div>
              <span className="kicker">Official public record</span>
              <h1>{view.title}</h1>
              <p>{view.issuingAuthority}</p>
            </div>
          </div>
          <span className="verified">
            <ShieldCheck size={14} />
            {view.canAsk
              ? "Indexed record"
              : doc.processing_status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="document-detail-actions">
          {view.originalHref ? (
            <a
              className="button"
              href={view.originalHref}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} /> View Original
            </a>
          ) : doc.r2_key ? (
            <a
              className="button"
              href={`/api/documents/${doc.id}/file`}
              target="_blank"
              rel="noreferrer"
            >
              <FileCheck2 size={15} /> Open Stored Document
            </a>
          ) : (
            <span className="document-action-unavailable">
              Original source URL not recorded
            </span>
          )}
          {view.canAsk && (
            <a className="outline-button" href="#ask-this-document">
              <Bot size={15} /> Ask This Document
            </a>
          )}
        </div>
        <div className="document-detail-meta">
          <div>
            <small>Document type</small>
            <strong>{view.documentType}</strong>
          </div>
          <div>
            <small>Government</small>
            <strong>{view.government}</strong>
          </div>
          <div>
            <small>Year</small>
            <strong>{view.year}</strong>
          </div>
          <div>
            <small>Issuing authority</small>
            <strong>{view.issuingAuthority}</strong>
          </div>
          <div>
            <small>Publication date</small>
            <strong>{view.publicationDate}</strong>
          </div>
          <div>
            <small>Indexing date</small>
            <strong>{view.indexingDate}</strong>
          </div>
          <div>
            <small>Page count</small>
            <strong>{view.pageCount}</strong>
          </div>
          <div className="document-source-field">
            <small>Source URL</small>
            {view.sourceUrl ? (
              <a href={view.sourceUrl} target="_blank" rel="noreferrer">
                {view.sourceUrl}
                <ExternalLink size={13} />
              </a>
            ) : (
              <strong>Not recorded</strong>
            )}
          </div>
        </div>
        {view.extractions.length > 0 && (
          <section className="document-extracted-summary">
            <div className="document-section-title">
              <span>
                <Layers3 size={18} /> Extracted data
              </span>
              <p>Counts are linked to this document’s indexed project rows.</p>
            </div>
            <div className="document-extracted-grid">
              {view.extractions.map((item) => (
                <div key={item.label}>
                  <strong>{item.value.toLocaleString()}</strong>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="document-content-section">
          <div className="document-section-title">
            <span>
              <LibraryBig size={18} /> Inside this record
            </span>
            <p>
              {doc.chunk_count.toLocaleString()} indexed text chunks
              {doc.page_count ? ` across ${doc.page_count} pages` : ""}.
            </p>
          </div>
          {preview.length > 0 ? (
            <div className="document-excerpts">
              {preview.map((chunk, index) => (
                <blockquote key={index}>
                  <small>
                    <CalendarDays size={13} />{" "}
                    {chunk.page ? `Page ${chunk.page}` : "Page unavailable"}
                  </small>
                  <p>
                    {chunk.text.slice(0, 520)}
                    {chunk.text.length > 520 ? "…" : ""}
                  </p>
                </blockquote>
              ))}
            </div>
          ) : (
            <div className="notice">
              No searchable text is available for preview.
            </div>
          )}
        </section>
        {view.canAsk ? (
          <section id="ask-this-document" className="document-ask-section">
            <DocumentAsk documentId={doc.id} documentTitle={doc.title} />
          </section>
        ) : (
          <div className="notice" style={{ marginTop: 22 }}>
            This document has not been indexed yet, so document-scoped Q&amp;A
            is unavailable.
          </div>
        )}
      </section>
    </Shell>
  );
}
