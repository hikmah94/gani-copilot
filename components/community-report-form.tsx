"use client";
import { CheckCircle2, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const STATUSES = ["Completed", "Ongoing", "Not Started", "Cannot Confirm"];

export function CommunityReportForm({ projectId }: { projectId: string }) {
  const [renderedAt] = useState(() => Date.now());
  const [status, setStatus] = useState("");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/config/public").then((r) => r.json()).then((data) => setSiteKey((data as { turnstileSiteKey: string | null }).turnstileSiteKey)).catch(() => {});
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("projectId", projectId);
    form.set("renderedAt", String(renderedAt));
    try {
      const response = await fetch("/api/feedback", { method: "POST", body: form });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to submit your report.");
      setDone(true);
      setStatus("");
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <div className="panel" style={{ textAlign: "center", padding: 30 }}>
    <CheckCircle2 color="#0b5d3b" style={{ margin: "0 auto 10px" }} />
    <p>Thank you. Your observation was recorded and will appear here once reviewed.</p>
  </div>;

  return <form ref={formRef} className="admin-form" onSubmit={submit}>
    <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} aria-hidden="true" />
    <label>
      <small className="meta">Have you seen this project in your community?</small>
      <select className="field" value={status} onChange={(e) => setStatus(e.target.value)} name="reportStatus" required>
        <option value="" disabled>Choose what you observed</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
    <textarea className="field" name="observation" value={observation} onChange={(e) => setObservation(e.target.value)} maxLength={2000} placeholder="Describe what you saw (optional but helpful)" rows={4} />
    <label>
      <small className="meta">Photo evidence (optional, up to 8 MB)</small>
      <input className="field" name="photo" type="file" accept="image/*" />
    </label>
    {siteKey && <div data-turnstile-sitekey={siteKey} className="meta">Verification widget loads once a Turnstile site key is configured.</div>}
    {error && <p className="notice">{error}</p>}
    <p className="meta">Reports never overwrite the official record — they are reviewed and shown as unverified community observations.</p>
    <button className="button" disabled={submitting} type="submit"><Send size={14} /> {submitting ? "Submitting…" : "Submit report"}</button>
  </form>;
}
