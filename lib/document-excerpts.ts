export function excerptSnippet(text: string, tokens: string[], radius = 150): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const lower = clean.toLowerCase();
  let at = -1;
  for (const token of tokens) {
    const index = lower.indexOf(token.toLowerCase());
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  if (at < 0) return clean.length > radius * 2 ? `${clean.slice(0, radius * 2).trim()}…` : clean;
  const start = Math.max(0, at - radius);
  const end = Math.min(clean.length, at + radius);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}

export function highlightParts(text: string, tokens: string[]): { text: string; match: boolean }[] {
  const usable = tokens.map((token) => token.trim()).filter(Boolean).map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!usable.length || !text) return [{ text, match: false }];
  // Splitting on a capture group alternates non-match / match parts, so odd indexes are matches.
  return text
    .split(new RegExp(`(${usable.join("|")})`, "gi"))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}
