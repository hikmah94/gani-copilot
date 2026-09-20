"use client";
import { BookOpen } from "lucide-react";
import { READER_PAGE_EVENT } from "@/components/pdf-reader";
import { pdfPageHref } from "@/lib/document-file";

export function ReaderPageLink({ page, href }: { page: number | null; href: string | null }) {
  if (!page || !href) return null;
  return <button
    type="button"
    className="excerpt-open"
    onClick={() => {
      if (window.matchMedia("(min-width: 801px)").matches) {
        window.dispatchEvent(new CustomEvent(READER_PAGE_EVENT, { detail: page }));
        document.getElementById("reader")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.open(pdfPageHref(href, page), "_blank", "noopener");
      }
    }}
  ><BookOpen size={13} /> Open page {page}</button>;
}
