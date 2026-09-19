import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, ExternalLink, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { CommunityReportForm } from "@/components/community-report-form";
import { getApprovedReportsForProject, getCommunityObservationCounts, getProjectById } from "@/lib/repo-projects";
import { getGovernmentName } from "@/lib/repo-overview";
import { formatMoney } from "@/lib/data";
import { locationLabel } from "@/lib/location-label";
import { trackEvent } from "@/lib/analytics";

const NOT_AVAILABLE = "Not available in currently indexed records.";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();
  const [reports, counts, government] = await Promise.all([
    getApprovedReportsForProject(id),
    getCommunityObservationCounts(id),
    getGovernmentName(),
  ]);
  void trackEvent("project_viewed", { projectId: id });

  const askUrl = (q: string) => `/ask?q=${encodeURIComponent(q)}&project_id=${encodeURIComponent(project.id)}`;
  const contextualQuestions = [
    "Explain this project.",
    "Where does this allocation come from?",
    project.mda_name && project.location_name ? `What other projects does ${project.mda_name} have in ${project.location_name}?` : "What other projects does this MDA have in this LGA?",
    "Compare this project with similar projects.",
    "Show me the source.",
  ];

  return <Shell>
    <section className="content" style={{ paddingTop: 40 }}>
      <Link href="/projects" className="back"><ArrowLeft size={15} /> Back to projects</Link>

      {/* Header */}
      <div>
        {project.verification_status === "verified" && <span className="verified"><ShieldCheck size={13} /> Verified Public Record</span>}
        <h1 className="detail-title">{project.title}</h1>
        <p className="meta">{project.sector_name || "Unclassified"} · {locationLabel(project.location_name)} · {project.budget_year}</p>
      </div>

      <div className="detail-grid">
        <div>
          {/* Description */}
          <p>{project.description || "No original record description has been indexed for this project yet."}</p>
          <Link href={askUrl(`Explain this project: ${project.title}`)} className="outline-button" style={{ marginTop: 10 }}><Bot size={14} /> Explain this project</Link>

          {/* Financial Information */}
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Financial information</h2>
          <div className="stat-row">
            <div><small>Approved allocation</small><strong>{formatMoney(project.approved_amount)}</strong></div>
            <div><small>Released amount</small><strong style={project.released_amount == null ? { fontSize: 12, color: "var(--muted)" } : undefined}>{project.released_amount != null ? formatMoney(project.released_amount) : NOT_AVAILABLE}</strong></div>
            <div><small>Budget year</small><strong>{project.budget_year}</strong></div>
          </div>
          <div className="stat-row">
            <div><small>Expenditure classification</small><strong>{project.capital_or_recurrent}</strong></div>
            <div style={{ gridColumn: "span 2" }}><small>Project status</small><strong style={{ fontSize: project.official_status ? undefined : 12, color: project.official_status ? undefined : "var(--muted)" }}>{project.official_status ? `Official Status: ${project.official_status}` : "Official status unavailable in currently indexed records."}</strong></div>
          </div>

          {/* Institutional Information */}
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Institutional information</h2>
          <div className="stat-row">
            <div><small>Responsible MDA</small><strong style={project.mda_name ? undefined : { fontSize: 12, color: "var(--muted)" }}>{project.mda_name || NOT_AVAILABLE}</strong></div>
            <div><small>Government</small><strong>{government}</strong></div>
            <div><small>Project code</small><strong>{project.project_code}</strong></div>
          </div>
          {project.contractor && <p className="meta" style={{ marginTop: 10 }}>Contractor: {project.contractor}{project.expected_completion ? ` · Expected completion: ${project.expected_completion}` : ""}</p>}

          {/* Location */}
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Location</h2>
          <div className="stat-row">
            <div><small>LGA</small><strong>{project.location_name || "Statewide"}</strong></div>
            <div><small>Senatorial zone</small><strong>{project.senatorial_zone || "—"}</strong></div>
            <div><small>State</small><strong>{project.state || "Niger"}</strong></div>
          </div>

          {/* Community Observations */}
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Community observations</h2>
          <p className="notice">These are reviewed community observations, not verified public records or official project-status updates. Pending reports are not shown.</p>
          {counts.total > 0 ? <div className="observation-counts">
            <div><small>Completed</small><strong>{counts.Completed}</strong></div>
            <div><small>Ongoing</small><strong>{counts.Ongoing}</strong></div>
            <div><small>Not started</small><strong>{counts["Not Started"]}</strong></div>
            <div><small>Cannot confirm</small><strong>{counts["Cannot Confirm"]}</strong></div>
          </div> : <p className="meta">No approved community observations are available for this project yet.</p>}
          {reports.length > 0 && <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {reports.map((r) => <div className="evidence-card" key={r.id}>
              <span className="meta">Community observation · {r.report_status}</span>
              {r.observation && <blockquote>{r.observation}</blockquote>}
              <small>Submitted {new Date(r.submitted_at).toLocaleDateString()}</small>
            </div>)}
          </div>}

          <h2 style={{ marginTop: 30, fontSize: 20 }}>Report what you see</h2>
          <CommunityReportForm projectId={project.id} />

          {/* Ask GANI About Project */}
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Ask GANI about this project</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {contextualQuestions.map((q) => <Link key={q} href={askUrl(q)} className="outline-button">{q}</Link>)}
          </div>
        </div>

        <aside>
          <div className="evidence-card">
            <span className="verified"><ShieldCheck size={13} /> Source evidence</span>
            {project.source_document_title ? <>
              <h3>{project.source_document_title}</h3>
              <p className="meta">{project.document_type || "Document"}{project.source_page ? ` · Page ${project.source_page}` : ""}</p>
              <p className="meta">{project.issuing_authority || NOT_AVAILABLE}{project.document_year ? ` · ${project.document_year}` : ""}</p>
              {project.source_reference && <p className="meta">{project.source_reference}</p>}
              {project.source_document_id && <Link href={`/documents/${project.source_document_id}`} className="outline-button" style={{ marginTop: 10 }}>View Evidence <ExternalLink size={14} /></Link>}
            </> : <p className="meta">{project.source_reference || NOT_AVAILABLE}</p>}
          </div>
        </aside>
      </div>
    </section>
  </Shell>;
}
