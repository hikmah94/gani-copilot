import { env } from "cloudflare:workers";
import { summarizePublicObservations, type ObservationCounts } from "@/lib/community-observations";

export type ProjectSummary = {
  id: string; project_code: string; title: string; description: string | null;
  budget_year: number; approved_amount: number; released_amount: number | null;
  capital_or_recurrent: string; verification_status: string; official_status: string | null;
  sector_name: string | null; mda_name: string | null; location_name: string | null;
  report_count: number;
};

export type ProjectFilters = { sector?: string; mda?: string; location?: string; year?: number; q?: string; limit?: number; offset?: number };

const JOIN_CLAUSE = `FROM projects
  LEFT JOIN sectors ON sectors.id = projects.sector_id
  LEFT JOIN mdas ON mdas.id = projects.mda_id
  LEFT JOIN locations ON locations.id = projects.location_id`;

const LIST_COLUMNS = `projects.id, projects.project_code, projects.title, projects.description,
  projects.budget_year, projects.approved_amount, projects.released_amount, projects.capital_or_recurrent,
  projects.verification_status, projects.official_status,
  sectors.name AS sector_name, mdas.name AS mda_name, locations.name AS location_name,
  (SELECT COUNT(*) FROM community_reports WHERE community_reports.project_id = projects.id AND community_reports.moderation_status = 'approved') AS report_count`;

function buildFilterClause(filters: ProjectFilters): { where: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.sector) { clauses.push("sectors.slug = ?"); params.push(filters.sector); }
  if (filters.mda) { clauses.push("mdas.id = ?"); params.push(filters.mda); }
  if (filters.location) { clauses.push("locations.id = ?"); params.push(filters.location); }
  if (filters.year) { clauses.push("projects.budget_year = ?"); params.push(filters.year); }
  if (filters.q) {
    clauses.push("(projects.title LIKE ? OR projects.description LIKE ? OR projects.project_code LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function listProjects(filters: ProjectFilters = {}): Promise<{ items: ProjectSummary[]; total: number }> {
  const { where, params } = buildFilterClause(filters);
  const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as count ${JOIN_CLAUSE}${where}`).bind(...params).first<{ count: number }>();
  const rows = await env.DB.prepare(`SELECT ${LIST_COLUMNS} ${JOIN_CLAUSE}${where} ORDER BY projects.budget_year DESC, projects.approved_amount DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset).all<ProjectSummary>();
  return { items: rows.results ?? [], total: Number(countRow?.count ?? 0) };
}

export type ProjectDetail = ProjectSummary & {
  contractor: string | null; expected_completion: string | null; source_page: number | null; source_reference: string | null;
  source_document_id: string | null; source_document_title: string | null; source_document_url: string | null;
  senatorial_zone: string | null; state: string | null;
  document_type: string | null; issuing_authority: string | null; document_year: number | null; publication_date: string | null;
};

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const row = await env.DB.prepare(`SELECT ${LIST_COLUMNS},
      projects.contractor, projects.expected_completion, projects.source_page, projects.source_reference,
      locations.senatorial_zone, locations.state,
      documents.id AS source_document_id, documents.title AS source_document_title, documents.original_url AS source_document_url,
      documents.document_type, documents.issuing_authority, documents.year AS document_year, documents.publication_date
      ${JOIN_CLAUSE}
      LEFT JOIN documents ON documents.id = projects.source_document_id
      WHERE projects.id = ?1`).bind(id).first<ProjectDetail>();
  return row ?? null;
}

export async function getProjectByIdentifier(identifier: string): Promise<ProjectDetail | null> {
  const row=await env.DB.prepare(`SELECT ${LIST_COLUMNS},
      projects.contractor, projects.expected_completion, projects.source_page, projects.source_reference,
      locations.senatorial_zone, locations.state,
      documents.id AS source_document_id, documents.title AS source_document_title, documents.original_url AS source_document_url,
      documents.document_type, documents.issuing_authority, documents.year AS document_year, documents.publication_date
      ${JOIN_CLAUSE}
      LEFT JOIN documents ON documents.id = projects.source_document_id
      WHERE projects.id=?1 OR projects.project_code=?1 LIMIT 1`).bind(identifier).first<ProjectDetail>();
  return row??null;
}

export type CommunityReportSummary = { id: string; report_status: string; observation: string | null; submitted_at: string; verification_status: string };

export async function getApprovedReportsForProject(projectId: string): Promise<CommunityReportSummary[]> {
  const rows = await env.DB.prepare(
    "SELECT id, report_status, observation, submitted_at, verification_status FROM community_reports WHERE project_id=?1 AND moderation_status='approved' ORDER BY submitted_at DESC LIMIT 20"
  ).bind(projectId).all<CommunityReportSummary>();
  return rows.results ?? [];
}

export async function getCommunityObservationCounts(projectId: string): Promise<ObservationCounts> {
  const rows = await env.DB.prepare("SELECT report_status, moderation_status, COUNT(*) as count FROM community_reports WHERE project_id=?1 AND moderation_status='approved' GROUP BY report_status, moderation_status").bind(projectId).all<{ report_status: string; moderation_status: string; count: number }>();
  return summarizePublicObservations(rows.results ?? []);
}

export type ProjectFacets = {
  sectors: { name: string; slug: string }[];
  mdas: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  years: number[];
};

export async function getProjectFacets(): Promise<ProjectFacets> {
  const [sectors, mdas, locations, years] = await env.DB.batch([
    env.DB.prepare("SELECT DISTINCT sectors.name, sectors.slug FROM sectors JOIN projects ON projects.sector_id = sectors.id ORDER BY sectors.name"),
    env.DB.prepare("SELECT DISTINCT mdas.id, mdas.name FROM mdas JOIN projects ON projects.mda_id = mdas.id ORDER BY mdas.name"),
    env.DB.prepare("SELECT DISTINCT locations.id, locations.name FROM locations JOIN projects ON projects.location_id = locations.id ORDER BY locations.name"),
    env.DB.prepare("SELECT DISTINCT budget_year FROM projects ORDER BY budget_year DESC"),
  ]);
  return {
    sectors: (sectors.results ?? []) as { name: string; slug: string }[],
    mdas: (mdas.results ?? []) as { id: string; name: string }[],
    locations: (locations.results ?? []) as { id: string; name: string }[],
    years: ((years.results ?? []) as { budget_year: number }[]).map((r) => Number(r.budget_year)),
  };
}
