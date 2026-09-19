"use client";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AdminTable, Empty, type Row } from "@/components/admin-dashboard";

type SecurityData = { turnstileConfigured: boolean; trackedRequests24h: number; topRoutes: { route: string; count: number }[]; failedLogins: Row[] };

export function SecurityPanel() {
  const [data, setData] = useState<SecurityData | null>(null);
  useEffect(() => { void (async () => { const r = await fetch("/api/admin/security"); if (r.ok) setData(await r.json() as SecurityData); })(); }, []);
  if (!data) return <div className="admin-card"><p className="meta">Loading security overview…</p></div>;
  return <>
    <div className="admin-metrics">
      <article><ShieldAlert /><span>Requests tracked (24h)</span><strong>{data.trackedRequests24h}</strong></article>
      <article><ShieldAlert /><span>Failed logins</span><strong>{data.failedLogins.length}</strong></article>
      <article><ShieldAlert /><span>Turnstile</span><strong>{data.turnstileConfigured ? "Configured" : "Not configured"}</strong></article>
    </div>
    <div className="admin-grid" style={{ marginTop: 18 }}>
      <section className="admin-card"><h2>Most rate-limited routes (24h)</h2>{data.topRoutes.length ? data.topRoutes.map((r) => <div className="admin-list-row" key={r.route}><div><b>{r.route}</b></div><small>{r.count} requests</small></div>) : <Empty text="No traffic recorded on rate-limited routes yet." />}</section>
      <AdminTable title="Recent failed sign-ins" rows={data.failedLogins} columns={["created_at", "actor", "summary"]} />
    </div>
    {!data.turnstileConfigured && <div className="notice" style={{ marginTop: 18 }}>Turnstile is not configured on this deployment. Community-report submissions rely on a honeypot field and a minimum-fill-time check until a site key is set.</div>}
  </>;
}
