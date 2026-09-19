import Link from "next/link";
import { ArrowRight, Building2, Check, Globe2, Languages, Map, Network, Radio, ShieldCheck, Users } from "lucide-react";
import { Shell } from "@/components/shell";

const phases = [
  {
    number: "01",
    scope: "Niger State",
    title: "Prove the model with one accountable public record system",
    description: "Make Niger State budgets consistently searchable, understandable and traceable before expanding the geography.",
    outcomes: ["Reliable document ingestion and evidence links", "Hausa-language and low-bandwidth user testing", "Civil-society correction and verification partnerships"],
    measure: "Citizens can find a relevant record, understand it and open its evidence without specialist help.",
    icon: Building2,
  },
  {
    number: "02",
    scope: "Across Nigeria",
    title: "Support states without erasing how each state works",
    description: "Create a reusable platform for additional states while preserving their own ministries, budget structures, terminology and source authorities.",
    outcomes: ["Configurable state and fiscal-year data models", "Local aliases for MDAs, sectors and LGAs", "State-based data stewards and moderation teams"],
    measure: "A new state can be added through documented source and governance work—not a custom rebuild.",
    icon: Map,
  },
  {
    number: "03",
    scope: "National network",
    title: "Connect public records without centralising public trust",
    description: "Enable cross-state discovery and comparison while each participating organisation remains responsible for its sources, corrections and community safeguards.",
    outcomes: ["Shared provenance and evidence standards", "Comparable indicators with accounting differences disclosed", "SMS, WhatsApp and voice access tested responsibly"],
    measure: "People can compare jurisdictions and still see who published, interpreted and verified every record.",
    icon: Network,
  },
  {
    number: "04",
    scope: "African adaptation",
    title: "Build with local institutions, languages and civic realities",
    description: "Adapt the open infrastructure with local partners rather than exporting a single Nigerian model to countries with different laws, languages and public-finance systems.",
    outcomes: ["Country-specific schemas and legal review", "Multilingual retrieval evaluated by native speakers", "Federated deployments with local data governance"],
    measure: "Each deployment is locally governed, source-compatible and demonstrably useful to the communities it serves.",
    icon: Globe2,
  },
] as const;

const foundations = [
  [ShieldCheck, "Evidence before reach", "Geographic growth must not outrun source quality, correction processes or community safety."],
  [Users, "Local ownership", "Civic groups, journalists, public institutions and residents shape terminology, priorities and safeguards."],
  [Languages, "Language is infrastructure", "Translation, voice and local terminology are tested with speakers—not added as a cosmetic layer."],
  [Radio, "Designed for real access", "Low-cost devices, weak connections and non-web channels are part of the product plan from the start."],
] as const;

export default function FuturePage() {
  return <Shell>
    <section className="roadmap-hero">
      <div className="roadmap-hero-copy">
        <span className="kicker">National and African growth plan</span>
        <h1>A practical path from Niger State to public information people can use across Africa.</h1>
        <p>GANI will scale by proving trust locally, building reusable infrastructure for Nigerian states, and adapting with African partners. Expansion depends on reliable records, local stewardship and evidence that people can use the service safely.</p>
        <div className="roadmap-hero-actions"><Link href="/documents" className="button">Explore current records <ArrowRight size={16} /></Link><Link href="/about" className="outline-button">How GANI works</Link></div>
      </div>
      <aside className="roadmap-start-card">
        <span>Starting point</span>
        <strong>Niger State</strong>
        <p>Nine document-backed annual budgets, structured project records, source evidence and moderated community observations.</p>
        <div><Check size={15} /> Build depth before breadth</div>
      </aside>
    </section>

    <section className="content roadmap-content">
      <div className="roadmap-intro">
        <div><span className="kicker">The strategy</span><h2>Four stages, each with a clear test.</h2></div>
        <p>The goal is not to collect the most documents. It is to shorten the distance between a public question and evidence a person can independently inspect.</p>
      </div>
      <div className="roadmap-phases">
        {phases.map((phase) => {
          const Icon = phase.icon;
          return <article className="roadmap-phase" key={phase.number}>
            <div className="roadmap-phase-marker"><span>{phase.number}</span><Icon /></div>
            <div className="roadmap-phase-body">
              <span className="roadmap-scope">{phase.scope}</span>
              <h3>{phase.title}</h3>
              <p>{phase.description}</p>
              <ul>{phase.outcomes.map((outcome) => <li key={outcome}><Check size={14} /> {outcome}</li>)}</ul>
              <div className="roadmap-measure"><small>Ready to advance when</small><strong>{phase.measure}</strong></div>
            </div>
          </article>;
        })}
      </div>

      <section className="roadmap-foundations">
        <div className="roadmap-intro"><div><span className="kicker">How we intend to scale</span><h2>Technology supports trust. It cannot replace it.</h2></div><p>Every expansion decision should protect provenance, local relevance, accessibility and the safety of people contributing information.</p></div>
        <div className="roadmap-foundation-grid">{foundations.map(([Icon, title, copy]) => <article key={title}><Icon /><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="roadmap-callout">
        <div><span className="kicker light">The partners this needs</span><h2>Public-interest technology grows through shared stewardship.</h2><p>Scaling GANI requires budget offices that publish usable records, civic organisations that understand community needs, journalists who test the evidence, language experts, researchers and responsible technology partners.</p></div>
        <Link href="/documents" className="light-button button">See the foundation <ArrowRight size={16} /></Link>
      </section>
    </section>
  </Shell>;
}
