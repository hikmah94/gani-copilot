export type ObservationCounts = { Completed: number; Ongoing: number; "Not Started": number; "Cannot Confirm": number; total: number };

export function summarizePublicObservations(rows: { report_status: string; moderation_status: string; count: number }[]): ObservationCounts {
  const counts: ObservationCounts = { Completed: 0, Ongoing: 0, "Not Started": 0, "Cannot Confirm": 0, total: 0 };
  for (const row of rows) {
    if (row.moderation_status !== "approved" || !Object.prototype.hasOwnProperty.call(counts, row.report_status) || row.report_status === "total") continue;
    const key = row.report_status as keyof Omit<ObservationCounts, "total">;
    counts[key] += Number(row.count);
    counts.total += Number(row.count);
  }
  return counts;
}
