import test from "node:test";
import assert from "node:assert/strict";
import { documentDetailView } from "../lib/document-detail-view.ts";

test("shows exact document-linked extraction counts and reads the record inside GANI", () => {
  const view = documentDetailView({
    id: "source-2025",
    title: "Niger State Approved 2026 Budget",
    document_type: "approved_budget",
    government_name: "Niger State",
    year: 2026,
    issuing_authority: "Niger State Government",
    publication_date: "2025-12-23",
    indexed_at: "2026-09-15 18:41:06",
    page_count: 399,
    original_url: "https://nspc.nigerstate.gov.ng/budget.pdf",
    r2_key: "public-records/2026/budget.pdf",
    processing_status: "indexed",
    project_count: 1016,
    mda_count: 119,
    sector_count: 11,
  });
  assert.deepEqual(view.extractions, [
    { label: "Projects extracted", value: 1016 },
    { label: "MDAs identified", value: 119 },
    { label: "Sectors identified", value: 11 },
  ]);
  assert.deepEqual(view.viewer, { kind: "stored", href: "/api/documents/source-2025/file" });
  assert.equal(view.downloadHref, "/api/documents/source-2025/file?download=1");
  assert.equal(view.publisher, "nspc.nigerstate.gov.ng");
  assert.equal(view.canAsk, true);
});

test("does not fabricate missing dates, counts, or a reader", () => {
  const view = documentDetailView({
    id: "future",
    title: "Unprocessed record",
    document_type: "Budget document",
    government_name: null,
    year: 2024,
    issuing_authority: "Niger State Government",
    publication_date: null,
    indexed_at: null,
    page_count: null,
    original_url: "https://www.vanguardngr.com/story/",
    r2_key: null,
    processing_status: "uploaded",
    project_count: 0,
    mda_count: 0,
    sector_count: 0,
  });
  assert.equal(view.publicationDate, "Not recorded");
  assert.equal(view.indexingDate, "Not indexed");
  assert.equal(view.pageCount, "Not recorded");
  assert.deepEqual(view.viewer, { kind: "none", href: null });
  assert.equal(view.downloadHref, null);
  assert.equal(view.canAsk, false);
  assert.deepEqual(view.extractions, []);
});
