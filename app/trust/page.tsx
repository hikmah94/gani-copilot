import { Shell } from "@/components/shell";
import { TrustBadge } from "@/components/trust-badge";
import { getTrustStats } from "@/lib/repo-trust";

export default async function Trust() {
  const stats = await getTrustStats();
  return <Shell>
    <section className="page-hero">
      <span className="kicker">Trust and verification</span>
      <h1>How GANI classifies every claim.</h1>
      <p>Every figure, project and report on GANI carries one of three trust classifications — shown here so you always know what you are reading.</p>
    </section>
    <section className="content">
      <div className="doc-grid">
        <article className="doc-card"><TrustBadge kind="verified" /><h3>Verified public record</h3><p>Derived directly from an indexed official source document, with a page and reference you can open.</p></article>
        <article className="doc-card"><TrustBadge kind="ai-interpretation" /><h3>AI interpretation</h3><p>A plain-language explanation generated from supplied verified records. AI explains; it never invents the figure.</p></article>
        <article className="doc-card"><TrustBadge kind="community" /><h3>Community report — unverified</h3><p>A citizen observation. It is reviewed by an administrator before it appears, and it never overwrites the official record.</p></article>
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <span className="kicker">Live verification stats</span>
        <div className="stat-row" style={{ marginTop: 14 }}>
          <div><small>Documents indexed</small><strong>{stats.documentsReady} / {stats.documentsTotal}</strong></div>
          <div><small>Projects verified</small><strong>{stats.projectsVerified} / {stats.projectsTotal}</strong></div>
          <div><small>Community reports approved</small><strong>{stats.communityReportsApproved} / {stats.communityReportsTotal}</strong></div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <span className="kicker">Confidence levels</span>
        <h2 style={{ fontSize: 22 }}>How confidence is calculated</h2>
        <p className="meta">High confidence: two or more independent pieces of evidence agree. Medium confidence: a single verified source is available. Low confidence: no verified evidence exists yet — GANI will say so rather than guess.</p>
      </div>
    </section>
  </Shell>;
}
