import { documentDownloadHref, documentViewerSource, publisherHost } from "./document-file.ts";

export type DocumentDetailFields = {
  id?: string;
  title: string;
  document_type: string;
  government_name: string | null;
  year: number;
  issuing_authority: string;
  publication_date: string | null;
  indexed_at: string | null;
  page_count: number | null;
  original_url: string | null;
  r2_key: string | null;
  processing_status: string;
  project_count: number;
  mda_count: number;
  sector_count: number;
};

export function documentDetailView(document: DocumentDetailFields) {
  const extractions = [
    { label: "Projects extracted", value: document.project_count },
    { label: "MDAs identified", value: document.mda_count },
    { label: "Sectors identified", value: document.sector_count },
  ].filter((item) => item.value > 0);
  const id = document.id ?? "";
  const viewer = documentViewerSource({ id, r2_key: document.r2_key, original_url: document.original_url });
  return {
    title: document.title,
    documentType: document.document_type.replaceAll("_", " "),
    government: document.government_name || "Not recorded",
    year: document.year,
    issuingAuthority: document.issuing_authority,
    publicationDate: document.publication_date?.slice(0, 10) || "Not recorded",
    indexingDate: document.indexed_at?.slice(0, 10) || "Not indexed",
    pageCount: document.page_count ?? "Not recorded",
    viewer,
    downloadHref: viewer.kind === "none" ? null : documentDownloadHref(id),
    publisher: publisherHost(document.original_url),
    canAsk:
      document.processing_status === "ready" ||
      document.processing_status === "indexed",
    extractions,
  };
}
