export type EvidenceItem = {
  key: string;
  title: string;
  detail: string;
  sourceType: string;
  href?: string;
  verification?: string;
  documentTitle?: string;
  issuingAuthority?: string;
  year?: number;
  documentType?: string;
  page?: number | null;
  section?: string;
  passage?: string;
  budgetLine?: string;
  projectTitle?: string;
  approvedAmount?: number;
  sourceUrl?: string;
  indexedAt?: string;
};

export type EvidenceConfidence =
  "High" | "Medium" | "Requires Verification" | "Unable to Verify";
export function confidenceFromEvidence(
  items: EvidenceItem[],
): EvidenceConfidence {
  if (!items.length) return "Unable to Verify";
  const structured = items.some(
    (item) =>
      item.sourceType === "verified-project" ||
      item.sourceType === "aggregate-query",
  );
  const documentary = items.some(
    (item) =>
      item.documentTitle &&
      item.issuingAuthority &&
      (item.page || item.passage || item.budgetLine),
  );
  if (structured && documentary) return "High";
  if (documentary) return "Medium";
  if (
    structured ||
    items.some((item) => item.sourceType === "official-document")
  )
    return "Requires Verification";
  return "Unable to Verify";
}
