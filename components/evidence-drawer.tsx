"use client";
import { ExternalLink, FileCheck2, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/analytics-client";
import type { EvidenceItem } from "@/lib/evidence";

export function EvidenceDrawer({
  open,
  items,
  onClose,
  title = "Open the records",
}: {
  open: boolean;
  items: EvidenceItem[];
  onClose: () => void;
  title?: string;
}) {
  useEffect(() => {
    if (open) track("evidence_opened", { count: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Evidence used for this answer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="kicker">Evidence used</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        {items.length ? (
          items.map((item) => (
            <article className="evidence-record" key={item.key}>
              <span className="verified">
                <ShieldCheck size={13} />
                {item.verification === "verified" ||
                item.sourceType === "verified-project"
                  ? "Verified Public Record"
                  : item.sourceType.replaceAll("-", " ")}
              </span>
              <h3>{item.documentTitle || item.title}</h3>
              {(item.issuingAuthority || item.year || item.documentType) && (
                <div className="evidence-meta">
                  {[item.issuingAuthority, item.year, item.documentType]
                    .filter(Boolean)
                    .map((value) => (
                      <span key={String(value)}>{value}</span>
                    ))}
                </div>
              )}
              {(item.page || item.section) && (
                <div className="evidence-location">
                  {item.page && <b>Page {item.page}</b>}
                  {item.section && <span>{item.section}</span>}
                </div>
              )}
              {(item.projectTitle || item.budgetLine) && (
                <div className="evidence-block">
                  <small>Relevant budget record</small>
                  <strong>{item.projectTitle || item.title}</strong>
                  {item.budgetLine && <p>{item.budgetLine}</p>}
                  {typeof item.approvedAmount === "number" && (
                    <>
                      <small>Approved allocation</small>
                      <b>
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                          maximumFractionDigits: 0,
                        }).format(item.approvedAmount)}
                      </b>
                    </>
                  )}
                </div>
              )}
              {(item.passage || (!item.projectTitle && item.detail)) && (
                <blockquote>{item.passage || item.detail}</blockquote>
              )}
              <p className="evidence-usage">
                GANI used this record when answering your question.
              </p>
              {item.indexedAt && (
                <small className="indexed-date">
                  Indexed{" "}
                  {new Date(item.indexedAt).toLocaleDateString("en-NG", {
                    dateStyle: "medium",
                  })}
                </small>
              )}
              <div className="evidence-actions">
                {item.href && (
                  <a className="outline-button" href={item.href}>
                    <FileCheck2 size={14} /> View full record
                  </a>
                )}
                {item.sourceUrl && (
                  <a
                    className="text-link"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original source <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="meta">
            Unable to verify this answer from the currently indexed evidence.
          </p>
        )}
      </aside>
    </div>
  );
}
