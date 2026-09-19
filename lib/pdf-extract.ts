import { extractText, getDocumentProxy } from "unpdf";

export type ExtractedPage = { page: number; text: string };

export async function extractDocumentPages(buffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text
    .map((pageText, index) => ({ page: index + 1, text: pageText.trim() }))
    .filter((entry) => entry.text.length > 0);
}
