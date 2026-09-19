import Link from "next/link";
import { Bot, FileCheck2, FolderSearch, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { DocumentLibraryFilters } from "@/components/document-library-filters";
import { getDocumentFacets, searchDocuments } from "@/lib/repo-documents";

type Params = {
  q?: string;
  year?: string;
  government?: string;
  type?: string;
  authority?: string;
  status?: string;
};

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
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
  return (
    <Shell>
      <section className="page-hero documents-hero">
        <span className="kicker">Official records library</span>
        <h1>Browse the records behind every answer.</h1>
        <p>
          Search indexed Niger State public documents by title, authority, year,
          type and processing status.
        </p>
      </section>
      <section className="content documents-library">
        <DocumentLibraryFilters facets={facets} current={params} />
        <div className="document-results-head">
          <div>
            <span className="kicker">Public records</span>
            <h2>
              {documents.length} document{documents.length === 1 ? "" : "s"}{" "}
              found
            </h2>
          </div>
          {Object.values(params).some(Boolean) && (
            <Link href="/documents" className="outline-button">
              Clear filters
            </Link>
          )}
        </div>
        {documents.length ? (
          <div className="document-library-grid">
            {documents.map((document) => {
              const indexed =
                document.processing_status === "ready" ||
                document.processing_status === "indexed";
              return (
                <article className="library-document-card" key={document.id}>
                  <div className="document-card-top">
                    <span className="document-icon">
                      <FileCheck2 />
                    </span>
                    <span className={indexed ? "verified" : "tag"}>
                      {indexed && <ShieldCheck size={13} />}{" "}
                      {indexed
                        ? "Indexed"
                        : document.processing_status.replaceAll("-", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="document-type">
                      {document.document_type.replaceAll("_", " ")}
                    </span>
                    <h3>{document.title}</h3>
                    <p>{document.issuing_authority}</p>
                  </div>
                  <div className="document-card-meta">
                    <div>
                      <small>Year</small>
                      <strong>{document.year}</strong>
                    </div>
                    <div>
                      <small>Government</small>
                      <strong>
                        {document.government_name || "Niger State"}
                      </strong>
                    </div>
                  </div>
                  <div className="extraction-count">
                    <FolderSearch size={18} />
                    <div>
                      <strong>
                        {Number(document.project_count).toLocaleString()}{" "}
                        project records extracted
                      </strong>
                      <small>
                        {document.page_count
                          ? document.page_count + " document pages"
                          : "Page count unavailable"}
                      </small>
                    </div>
                  </div>
                  <div className="document-card-actions">
                    <Link className="button" href={"/documents/" + document.id}>
                      Open document
                    </Link>
                    <Link
                      className="outline-button"
                      href={
                        "/ask?q=" +
                        encodeURIComponent(
                          "What does " + document.title + " say?",
                        )
                      }
                    >
                      <Bot size={14} /> Ask GANI
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel empty-state-panel">
            <FolderSearch size={38} />
            <h2>No documents match these filters.</h2>
            <p>Try a broader title, another year, or clear the filters.</p>
            <Link href="/documents" className="button">
              Clear filters
            </Link>
          </div>
        )}
      </section>
    </Shell>
  );
}
