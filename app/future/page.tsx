import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe2, Radio, ShieldCheck, Workflow } from "lucide-react";
import { Shell } from "@/components/shell";

const working = [
  ["Open civic search", "Search indexed budgets, projects and public documents without an account."],
  ["Evidence-first answers", "Ask GANI about a selected document and open the supporting public record when passages are available."],
  ["Community observations", "Submit an observation for review. Approved reports remain separate from official project facts."],
];

const planned = [
  ["More local languages", "Test Hausa and other locally relevant language support with communities and reviewers.", Globe2],
  ["Lower-bandwidth access", "Make key records usable offline and on unreliable connections.", Radio],
  ["Faster document updates", "Automate source ingestion and indexing with Cloudflare Queues and Workflows.", Workflow],
  ["Stronger safeguards", "Add configured Turnstile, abuse monitoring and clearer moderation operations.", ShieldCheck],
  ["AI operations", "Add AI Gateway controls and deeper evaluation of answer quality and cost.", Workflow],
] as const;

export default function FuturePage() {
  return <Shell>
    <section className="page-hero">
      <span className="kicker">Product roadmap</span>
      <h1>Useful today. Honest about what comes next.</h1>
      <p>GANI is a civic-information proof of concept for Niger State. This page separates the working MVP from future implementation ideas; planned features are not available yet.</p>
    </section>
    <section className="content" style={{ paddingBottom: 70 }}>
      <div className="panel" style={{ marginBottom: 30 }}>
        <span className="kicker">Available in this MVP</span>
        <h2>Working now</h2>
        <div className="doc-grid" style={{ marginTop: 20 }}>
          {working.map(([title, description]) => <article className="doc-card" key={title}><CheckCircle2 size={22} color="#0b5d3b" /><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
      <span className="kicker">Future implementation</span>
      <h2>Planned next</h2>
      <p className="meta">These are development priorities, not claims about deployed capabilities. They need user testing, reliable data and operational safeguards.</p>
      <div className="doc-grid" style={{ marginTop: 20 }}>
        {planned.map(([title, description, Icon]) => <article className="doc-card" key={title}><Icon size={22} color="#0b5d3b" /><small className="kicker">Planned</small><h3>{title}</h3><p>{description}</p></article>)}
      </div>
      <div className="panel" style={{ marginTop: 30 }}><h2>Start with the public record</h2><p>See what is indexed today, inspect its source and tell us where the evidence is incomplete.</p><Link className="button" href="/search">Search records <ArrowRight size={16} /></Link></div>
    </section>
  </Shell>;
}
