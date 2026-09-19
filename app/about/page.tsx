import Link from "next/link";
import { ArrowRight, Calculator, FileSearch, MessageCircleQuestion, Newspaper, Search, ShieldCheck, Users } from "lucide-react";
import { Shell } from "@/components/shell";

const journey = [
  [Search, "Find", "Search budgets, projects, locations, ministries and official documents in ordinary language."],
  [Calculator, "Understand", "GANI calculates figures from structured records and explains public-finance terms without changing their meaning."],
  [ShieldCheck, "Verify", "Open the document, page and passage used for an important answer. If adequate evidence is missing, GANI says so."],
  [Users, "Contribute", "Share a community observation for review without allowing it to overwrite the official project record."],
] as const;

const audiences = [
  [Users, "Residents and community leaders", "Find what was approved for a place, understand who is responsible and know what the public record does—or does not—confirm."],
  [Newspaper, "Journalists and civic organisations", "Trace claims to source pages, explore allocations and identify questions that need reporting or formal information requests."],
  [FileSearch, "Public institutions", "Make published records easier to navigate while retaining the issuing authority and original document as the source of truth."],
] as const;

export default function About() {
  return <Shell>
    <section className="about-hero">
      <div>
        <span className="kicker">About GANI Copilot</span>
        <h1>Public records should answer public questions.</h1>
        <p>GANI helps people understand Niger State budgets and projects without needing to read hundreds of pages or work through a spreadsheet. Every important answer is designed to lead back to the record it came from.</p>
        <div className="about-actions"><Link href="/search" className="button">Search public records <ArrowRight size={16} /></Link><Link href="/ask" className="outline-button"><MessageCircleQuestion size={16} /> Ask GANI</Link></div>
      </div>
      <aside className="about-problem-card"><span>The problem</span><p>A document can be publicly available and still be difficult to find, interpret or verify. That gap limits meaningful participation and makes unsupported claims harder to challenge.</p></aside>
    </section>

    <section className="content about-content">
      <div className="about-purpose">
        <div><span className="kicker">What GANI changes</span><h2>From a published PDF to a usable public answer.</h2></div>
        <div><p>Government budgets contain decisions that affect roads, schools, healthcare, agriculture and livelihoods. Yet information is often spread across long documents, inconsistent labels and technical tables.</p><p>GANI organises those records into searchable data, uses controlled AI tools to explain them, and keeps the evidence close enough for a citizen to check the answer independently.</p></div>
      </div>

      <section className="about-journey">
        <span className="kicker">The citizen journey</span><h2>One question can lead all the way to the source.</h2>
        <div className="about-journey-grid">{journey.map(([Icon, title, copy], index) => <article key={title}><span className="about-step">0{index + 1}</span><Icon /><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="about-audiences">
        <div className="about-section-heading"><span className="kicker">Who it is for</span><h2>Built around real public-information needs.</h2></div>
        <div className="about-audience-grid">{audiences.map(([Icon, title, copy]) => <article key={title}><Icon /><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
      </section>

      <section className="about-ai-boundary">
        <div><span className="kicker light">The role of AI</span><h2>AI explains the record. It does not become the record.</h2></div>
        <div className="about-boundary-list">
          <p><strong>Calculations come from software.</strong> Totals, percentages, rankings and comparisons are computed from structured records.</p>
          <p><strong>Answers remain evidence-bound.</strong> Document questions use passages retrieved from the selected document, not unrestricted model knowledge.</p>
          <p><strong>Uncertainty stays visible.</strong> Missing, partial or conflicting evidence is shown as a limitation rather than filled with a confident guess.</p>
        </div>
      </section>

      <section className="about-not-claiming">
        <div><ShieldCheck /><h2>What GANI does not claim</h2></div>
        <p>An approved budget is not proof that money was released or a project was completed. A community observation is not an official government status. GANI is not an audited spending register, an emergency-reporting service or a substitute for investigation. It is a clearer route into the public evidence that exists.</p>
      </section>

      <section className="about-next"><div><span className="kicker">Where this can go</span><h2>Start locally, then build a shared civic-information infrastructure.</h2><p>The expansion plan begins with stronger Niger State coverage, then reusable state deployments across Nigeria and locally governed adaptations across Africa.</p></div><Link href="/future" className="button">Read the growth plan <ArrowRight size={16} /></Link></section>
    </section>
  </Shell>;
}
