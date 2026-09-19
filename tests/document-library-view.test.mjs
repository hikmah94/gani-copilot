import test from "node:test";
import assert from "node:assert/strict";
import { documentLibraryView } from "../lib/document-library-view.ts";

test("uses citizen-facing labels without claiming AI readiness", () => {
  assert.deepEqual(documentLibraryView({ processingStatus: "indexed", projectCount: 342, pageCount: 118 }), {
    statusLabel: "Record indexed",
    statusTone: "indexed",
    projectLabel: "342 project records extracted",
    pageLabel: "118 pages",
  });
});

test("states missing extraction and page information plainly", () => {
  assert.deepEqual(documentLibraryView({ processingStatus: "uploaded", projectCount: 0, pageCount: null }), {
    statusLabel: "Preparing record",
    statusTone: "pending",
    projectLabel: "No project records extracted",
    pageLabel: "Page count not recorded",
  });
});
