import test from "node:test";
import assert from "node:assert/strict";
import { ftsQuery, mergeMatches } from "../lib/document-lexical.ts";

test("ftsQuery quotes meaningful terms and drops stopwords", () => {
  assert.equal(ftsQuery("What is the total budget?"), '"total" OR "budget"');
  assert.equal(ftsQuery("How much is allocated to the Ministry of Health?"), '"allocated" OR "ministry" OR "health"');
});

test("ftsQuery neutralises FTS syntax and returns null when nothing is searchable", () => {
  assert.equal(ftsQuery('budget" OR * NEAR('), '"budget" OR "near"');
  assert.equal(ftsQuery("what is it?"), null);
  assert.equal(ftsQuery("  "), null);
});

test("mergeMatches keeps vector order, appends new lexical ids, caps the total", () => {
  const merged = mergeMatches([{ id: "a", score: 0.9, metadata: { document_id: "d" } }], ["a", "b", "c"], "d", 3);
  assert.deepEqual(merged.map((match) => match.id), ["a", "b", "c"]);
  assert.equal(merged[1].metadata.document_id, "d");
  assert.equal(mergeMatches([], ["x", "y"], "d", 1).length, 1);
});
