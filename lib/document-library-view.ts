type DocumentLibraryInput = {
  processingStatus: string;
  projectCount: number;
  pageCount: number | null;
};

export function documentLibraryView(input: DocumentLibraryInput) {
  const indexed = input.processingStatus === "indexed" || input.processingStatus === "ready";
  return {
    statusLabel: indexed ? "Record indexed" : "Preparing record",
    statusTone: indexed ? "indexed" : "pending",
    projectLabel: input.projectCount > 0
      ? `${input.projectCount.toLocaleString()} project record${input.projectCount === 1 ? "" : "s"} extracted`
      : "No project records extracted",
    pageLabel: input.pageCount ? `${input.pageCount.toLocaleString()} page${input.pageCount === 1 ? "" : "s"}` : "Page count not recorded",
  } as const;
}
