"use client";
import { Download, Expand, FileText, MonitorSmartphone } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { pdfPageHref } from "@/lib/document-file";

export const READER_PAGE_EVENT = "gani:reader-page";

type Props = { href: string; downloadHref: string; title: string; pageCount: number | null };

export function PdfReader({ href, downloadHref, title, pageCount }: Props) {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("1");
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 801px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    const onPage = (event: Event) => {
      const next = Number((event as CustomEvent<number>).detail);
      if (Number.isInteger(next) && next > 0) { setPage(next); setInput(String(next)); }
    };
    window.addEventListener(READER_PAGE_EVENT, onPage);
    return () => { query.removeEventListener("change", sync); window.removeEventListener(READER_PAGE_EVENT, onPage); };
  }, []);

  function go(event: FormEvent) {
    event.preventDefault();
    const requested = Math.floor(Number(input));
    if (!Number.isFinite(requested) || requested < 1) return;
    const next = pageCount ? Math.min(requested, pageCount) : requested;
    setPage(next);
    setInput(String(next));
  }

  return <div className="reader-card" id="reader">
    <div className="reader-head">
      <span className="reader-head-title"><FileText size={17} /> Document reader</span>
      <div className="reader-tools">
        <form className="reader-page-form" onSubmit={go}>
          <label htmlFor="reader-page">Page</label>
          <input id="reader-page" inputMode="numeric" value={input} onChange={(event) => setInput(event.target.value)} aria-label="Go to page" />
          {pageCount ? <span>of {pageCount.toLocaleString()}</span> : null}
          <button className="outline-button" type="submit">Go</button>
        </form>
        <a className="outline-button" href={pdfPageHref(href, page)} target="_blank" rel="noopener"><Expand size={14} /> Full screen</a>
        <a className="outline-button" href={downloadHref}><Download size={14} /> Download</a>
      </div>
    </div>
    <div className="reader-frame-wrap">
      {wide ? <iframe key={page} className="reader-frame" src={pdfPageHref(href, page)} title={`${title} — PDF reader`} /> : null}
      <noscript><p className="reader-noscript">JavaScript is needed for the embedded reader. <a href={href}>Open the PDF</a>.</p></noscript>
    </div>
    <div className="reader-mobile-cta">
      <span className="reader-mobile-icon"><MonitorSmartphone size={26} /></span>
      <h3>Read this PDF on your device</h3>
      <p>Long budget documents are easiest to read in your phone&apos;s full PDF viewer. It opens here on GANI — you stay on this site.</p>
      <a className="button" href={href} target="_blank" rel="noopener"><FileText size={15} /> Open PDF reader</a>
      <a className="outline-button" href={downloadHref}><Download size={14} /> Download PDF</a>
    </div>
  </div>;
}
