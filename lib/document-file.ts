const ALLOWED_DOCUMENT_HOSTS = new Set([
  "nspc.nigerstate.gov.ng",
  "nogp.nigerstate.gov.ng",
  "nigerstate.gov.ng",
  "s3.eu-west-2.amazonaws.com",
  "yourbudgit.com",
  "www.yourbudgit.com",
]);

const DOCUMENT_PREVIEWS = new Set([
  "source-2018", "source-2019", "source-2020", "source-2021", "source-2022",
  "source-2023", "source-2024", "source-2025", "source-2026",
  "niger-state-2026-approved-budget-detailed",
]);

export type ViewerSource =
  | { kind: "stored"; href: string }
  | { kind: "publisher"; href: string; host: string }
  | { kind: "none"; href: null };

export function documentFileHref(documentId: string) {
  return `/api/documents/${encodeURIComponent(documentId)}/file`;
}

export function documentDownloadHref(documentId: string) {
  return `${documentFileHref(documentId)}?download=1`;
}

export function allowedPdfSourceUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_DOCUMENT_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Chooses what the in-app reader may load. The returned href is always the
 * same-origin GANI route: readers never navigate to, or embed, another website.
 * A stored copy wins; otherwise only a recorded PDF on an allow-listed public
 * host is proxied through GANI.
 */
export function documentViewerSource(doc: { id: string; r2_key: string | null; original_url: string | null }): ViewerSource {
  if (doc.r2_key) return { kind: "stored", href: documentFileHref(doc.id) };
  const source = allowedPdfSourceUrl(doc.original_url);
  if (source && source.pathname.toLowerCase().endsWith(".pdf")) {
    return { kind: "publisher", href: documentFileHref(doc.id), host: source.hostname };
  }
  return { kind: "none", href: null };
}

export function publisherHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function pdfPageHref(href: string, page: number | null | undefined) {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  return `${href}#page=${safePage}&view=FitH`;
}

export function documentPreviewHref(documentId: string) {
  return DOCUMENT_PREVIEWS.has(documentId) ? `/document-previews/${documentId}.jpg` : null;
}
