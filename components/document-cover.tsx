import { FileText } from "lucide-react";
import { documentPreviewHref } from "@/lib/document-file";

export function DocumentCover({ id, title, year, type, size = "card" }: { id: string; title: string; year: number; type: string; size?: "card" | "side" }) {
  const src = documentPreviewHref(id);
  return <div className={`doc-cover doc-cover-${size}`}>
    {src
      ? <img src={src} alt={`First page of ${title}`} loading="lazy" decoding="async" width={640} height={452} />
      : <div className="doc-cover-fallback"><FileText size={size === "card" ? 34 : 26} /><b>{year}</b><span>{type.replaceAll("_", " ")}</span></div>}
  </div>;
}
