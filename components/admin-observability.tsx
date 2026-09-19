"use client";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Bot, RefreshCw } from "lucide-react";
import { AdminTable, Empty, type Row } from "@/components/admin-dashboard";

type Check = { name: string; status: "operational" | "degraded" | "not_configured"; detail: string };
type HealthData = { checks: Check[]; ingestionBacklog: number; ingestionFailed: number };

export function SystemHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); try { const r = await fetch("/api/admin/system-health"); if (r.ok) setData(await r.json() as HealthData); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  if (!data) return <div className="admin-card"><p className="meta">Loading system health…</p></div>;
  return <>
    <div className="admin-top" style={{ marginBottom: 14 }}>
      <div><span className="kicker">Live signals</span><h2 style={{ fontSize: 22, margin: "6px 0 0" }}>System health</h2></div>
      <button className="outline-button" onClick={() => void load()} disabled={loading}><RefreshCw size={13} /> Refresh</button>
    </div>
    <div className="health-grid">
      {data.checks.map((c) => <div className="health-card" key={c.name}>
        <span className={`health-status ${c.status}`}>{c.status.replaceAll("_", " ")}</span>
        <h3>{c.name}</h3>
        <p className="meta">{c.detail}</p>
      </div>)}
    </div>
    <div className="admin-metrics" style={{ marginTop: 18 }}>
      <article><Activity /><span>Ingestion backlog</span><strong>{data.ingestionBacklog}</strong></article>
      <article><Activity /><span>Failed ingestion jobs</span><strong>{data.ingestionFailed}</strong></article>
    </div>
  </>;
}

type AiData = { totalRequests: number; totalErrors: number; avgLatencyMs: number | null; requestsToday: number; errorsToday: number; byType: { query_type: string; count: number }[]; recent: Row[] };

export function AiMonitoringPanel() {
  const [data, setData] = useState<AiData | null>(null);
  useEffect(() => { void (async () => { const r = await fetch("/api/admin/ai-monitoring"); if (r.ok) setData(await r.json() as AiData); })(); }, []);
  if (!data) return <div className="admin-card"><p className="meta">Loading AI monitoring…</p></div>;
  const errorRate = data.totalRequests > 0 ? ((data.totalErrors / data.totalRequests) * 100).toFixed(1) : "0.0";
  return <>
    <div className="admin-metrics">
      <article><Bot /><span>Requests today</span><strong>{data.requestsToday}</strong><small>{data.errorsToday} error{data.errorsToday === 1 ? "" : "s"}</small></article>
      <article><Bot /><span>Total requests</span><strong>{data.totalRequests}</strong></article>
      <article><Bot /><span>Error rate</span><strong>{errorRate}%</strong></article>
      <article><Bot /><span>Avg latency</span><strong>{data.avgLatencyMs ? `${data.avgLatencyMs}ms` : "—"}</strong></article>
    </div>
    <div className="admin-grid" style={{ marginTop: 18 }}>
      <section className="admin-card"><h2>Requests by type</h2>{data.byType.length ? data.byType.map((t) => <div className="admin-list-row" key={t.query_type}><div><b>{t.query_type}</b></div><small>{t.count}</small></div>) : <Empty text="No AI requests recorded yet." />}</section>
      <AdminTable title="Recent AI requests" rows={data.recent} columns={["created_at", "provider", "query_type", "status", "latency_ms"]} />
    </div>
  </>;
}

type AnalyticsData = { byType: { event_type: string; count: number }[]; evidenceOpenRate: number | null };

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  useEffect(() => { void (async () => { const r = await fetch("/api/admin/analytics"); if (r.ok) setData(await r.json() as AnalyticsData); })(); }, []);
  if (!data) return <div className="admin-card"><p className="meta">Loading analytics…</p></div>;
  return <>
    <div className="admin-metrics">
      <article><BarChart3 /><span>Evidence open rate</span><strong>{data.evidenceOpenRate !== null ? `${data.evidenceOpenRate}%` : "—"}</strong><small>of questions asked</small></article>
    </div>
    <section className="admin-card" style={{ marginTop: 18 }}>
      <h2>Events by type</h2>
      {data.byType.length ? data.byType.map((t) => <div className="admin-list-row" key={t.event_type}><div><b>{t.event_type.replaceAll("_", " ")}</b></div><small>{t.count}</small></div>) : <Empty text="No analytics events recorded yet." />}
    </section>
  </>;
}
