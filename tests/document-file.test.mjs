import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedPdfSourceUrl, documentDownloadHref, documentFileHref, documentPreviewHref,
  documentViewerSource, pdfPageHref, publisherHost,
} from "../lib/document-file.ts";

test("keeps document reading on a same-origin GANI route", () => {
  assert.equal(documentFileHref("source-2025"), "/api/documents/source-2025/file");
  assert.equal(documentDownloadHref("source-2025"), "/api/documents/source-2025/file?download=1");
});

test("allows only recorded public HTTPS hosts used for civic documents", () => {
  assert.equal(allowedPdfSourceUrl("https://nspc.nigerstate.gov.ng/budget.pdf")?.hostname, "nspc.nigerstate.gov.ng");
  assert.equal(allowedPdfSourceUrl("http://127.0.0.1/private.pdf"), null);
  assert.equal(allowedPdfSourceUrl("https://evil.example/budget.pdf"), null);
});

test("prefers a stored copy and never exposes an external href to the reader", () => {
  const stored = documentViewerSource({ id: "source-2025", r2_key: "public-records/2025/a.pdf", original_url: "https://nspc.nigerstate.gov.ng/a.pdf" });
  assert.deepEqual(stored, { kind: "stored", href: "/api/documents/source-2025/file" });
  const publisher = documentViewerSource({ id: "source-2019", r2_key: null, original_url: "https://nspc.nigerstate.gov.ng/x/Budget.PDF" });
  assert.deepEqual(publisher, { kind: "publisher", href: "/api/documents/source-2019/file", host: "nspc.nigerstate.gov.ng" });
  assert.ok(publisher.href.startsWith("/api/"));
});

test("offers no reader for non-PDF, news, private, or missing sources", () => {
  const none = { kind: "none", href: null };
  assert.deepEqual(documentViewerSource({ id: "a", r2_key: null, original_url: "https://www.vanguardngr.com/2017/04/story/" }), none);
  assert.deepEqual(documentViewerSource({ id: "a", r2_key: null, original_url: "https://nigerstate.gov.ng/news-page/" }), none);
  assert.deepEqual(documentViewerSource({ id: "a", r2_key: null, original_url: "http://127.0.0.1/private.pdf" }), none);
  assert.deepEqual(documentViewerSource({ id: "a", r2_key: null, original_url: null }), none);
});

test("reports the publisher as plain text and builds safe page fragments", () => {
  assert.equal(publisherHost("https://www.yourbudgit.com/a.pdf"), "yourbudgit.com");
  assert.equal(publisherHost("not a url"), null);
  assert.equal(publisherHost(null), null);
  assert.equal(pdfPageHref("/api/documents/x/file", 42), "/api/documents/x/file#page=42&view=FitH");
  assert.equal(pdfPageHref("/api/documents/x/file", null), "/api/documents/x/file#page=1&view=FitH");
  assert.equal(pdfPageHref("/api/documents/x/file", -3), "/api/documents/x/file#page=1&view=FitH");
});

test("returns generated previews only for known document covers, else a designed fallback", () => {
  assert.equal(documentPreviewHref("source-2025"), "/document-previews/source-2025.jpg");
  assert.equal(documentPreviewHref("future-upload"), null);
  assert.equal(documentPreviewHref("niger-state-2026-approved-budget-detailed"), "/document-previews/niger-state-2026-approved-budget-detailed.jpg");
});
