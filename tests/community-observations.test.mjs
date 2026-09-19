import test from "node:test";
import assert from "node:assert/strict";
import { summarizePublicObservations } from "../lib/community-observations.ts";

test("pending and rejected reports cannot appear in public observation counts", () => {
  assert.deepEqual(summarizePublicObservations([
    { report_status: "Completed", moderation_status: "pending", count: 5 },
    { report_status: "Ongoing", moderation_status: "approved", count: 2 },
    { report_status: "Not Started", moderation_status: "rejected", count: 3 },
  ]), { Completed: 0, Ongoing: 2, "Not Started": 0, "Cannot Confirm": 0, total: 2 });
});
