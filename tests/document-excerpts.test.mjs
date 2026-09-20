import test from "node:test";
import assert from "node:assert/strict";
import { excerptSnippet, highlightParts } from "../lib/document-excerpts.ts";

test("centres the snippet on the earliest matching token and marks trimmed edges", () => {
  const text = `${"lead ".repeat(80)}The health sector allocation is significant. ${"tail ".repeat(80)}`;
  const snippet = excerptSnippet(text, ["allocation"], 40);
  assert.ok(snippet.includes("allocation"));
  assert.ok(snippet.startsWith("…") && snippet.endsWith("…"));
  assert.ok(snippet.length < 120);
});

test("falls back to the opening text when no token matches and collapses whitespace", () => {
  assert.equal(excerptSnippet("Line one\n\n  line   two", ["zzz"], 150), "Line one line two");
  assert.equal(excerptSnippet("   ", ["a"]), "");
});

test("highlights every token match case-insensitively without breaking regex characters", () => {
  const parts = highlightParts("Health and HEALTH (capital)", ["health", "(capital)"]);
  assert.deepEqual(parts.filter((part) => part.match).map((part) => part.text), ["Health", "HEALTH", "(capital)"]);
  assert.equal(parts.map((part) => part.text).join(""), "Health and HEALTH (capital)");
  assert.deepEqual(highlightParts("plain", []), [{ text: "plain", match: false }]);
});
