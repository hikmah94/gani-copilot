import { env } from "cloudflare:workers";

export type ExplorerSort = "allocation_desc" | "allocation_asc" | "name" | "recent" | "location";

export type ExplorerFilters = {
  q?: string; year?: number; state?: string; senatorialZone?: string; lga?: string;
  sector?: string; mda?: string; expenditureType?: "Capital" | "Recurrent";
  status?: string; minAllocation?: number; maxAllocation?: number;
  sort?: ExplorerSort; page?: number; pageSize?: number;
  verificationStatus?: string; hasCommunityObservation?: boolean;
  hasReleasedAmount?: boolean; hasContractor?: boolean;
};

export type ExplorerResult = {
  id: string; title: string; project_code: string; approved_amount: number; capital_or_recurrent: string;
  budget_year: number; verification_status: string; official_status: string | null;
  sector_name: string | null; location_name: string | null; mda_name: string | null;
  source_document_id: string | null; source_document_title: string | null; source_reference: string | null;
};

const JOIN = `FROM projects
  LEFT JOIN sectors ON sectors.id = projects.sector_id
  LEFT JOIN mdas ON mdas.id = projects.mda_id
  LEFT JOIN locations ON locations.id = projects.location_id
  LEFT JOIN documents ON documents.id = projects.source_document_id`;

const COLUMNS = `projects.id, projects.title, projects.project_code, projects.approved_amount, projects.capital_or_recurrent,
  projects.budget_year, projects.verification_status, projects.official_status,
  sectors.name AS sector_name, locations.name AS location_name, mdas.name AS mda_name,
  documents.id AS source_document_id, documents.title AS source_document_title, projects.source_reference`;

const SORT_MAP: Record<ExplorerSort, string> = {
  allocation_desc: "projects.approved_amount DESC",
  allocation_asc: "projects.approved_amount ASC",
  name: "projects.title ASC",
  recent: "projects.updated_at DESC",
  location: "locations.name ASC",
};

function buildFilterClause(filters: ExplorerFilters): { where: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.q) { clauses.push("(projects.title LIKE ? OR mdas.name LIKE ? OR sectors.name LIKE ? OR locations.name LIKE ? OR projects.project_code LIKE ?)"); const like = `%${filters.q}%`; params.push(like, like, like, like, like); }
  if (filters.year) { clauses.push("projects.budget_year = ?"); params.push(filters.year); }
  if (filters.state) { clauses.push("locations.state = ?"); params.push(filters.state); }
  if (filters.senatorialZone) { clauses.push("locations.senatorial_zone = ?"); params.push(filters.senatorialZone); }
  if (filters.lga) { clauses.push("locations.id = ?"); params.push(filters.lga); }
  if (filters.sector) { clauses.push("sectors.slug = ?"); params.push(filters.sector); }
  if (filters.mda) { clauses.push("mdas.id = ?"); params.push(filters.mda); }
  if (filters.expenditureType) { clauses.push("projects.capital_or_recurrent = ?"); params.push(filters.expenditureType); }
  if (filters.status) { clauses.push("projects.official_status = ?"); params.push(filters.status); }
  if (filters.minAllocation != null) { clauses.push("projects.approved_amount >= ?"); params.push(filters.minAllocation); }
  if (filters.maxAllocation != null) { clauses.push("projects.approved_amount <= ?"); params.push(filters.maxAllocation); }
  if (filters.verificationStatus) { clauses.push("projects.verification_status = ?"); params.push(filters.verificationStatus); }
  if (filters.hasCommunityObservation === true) clauses.push("EXISTS (SELECT 1 FROM community_reports WHERE community_reports.project_id = projects.id)");
  if (filters.hasCommunityObservation === false) clauses.push("NOT EXISTS (SELECT 1 FROM community_reports WHERE community_reports.project_id = projects.id)");
  if (filters.hasReleasedAmount === true) clauses.push("projects.released_amount IS NOT NULL");
  if (filters.hasReleasedAmount === false) clauses.push("projects.released_amount IS NULL");
  if (filters.hasContractor === true) clauses.push("projects.contractor IS NOT NULL AND projects.contractor != ''");
  if (filters.hasContractor === false) clauses.push("(projects.contractor IS NULL OR projects.contractor = '')");
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function searchExplorer(filters: ExplorerFilters): Promise<{ items: ExplorerResult[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const { where, params } = buildFilterClause(filters);
  const orderBy = SORT_MAP[filters.sort || "allocation_desc"] || SORT_MAP.allocation_desc;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as count ${JOIN}${where}`).bind(...params).first<{ count: number }>();
  const rows = await env.DB.prepare(`SELECT ${COLUMNS} ${JOIN}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...params, pageSize, offset).all<ExplorerResult>();
  const total = Number(countRow?.count ?? 0);
  return { items: rows.results ?? [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type ExplorerFacets = {
  states: string[]; senatorialZones: string[]; lgas: { id: string; name: string }[];
  sectors: { name: string; slug: string }[]; mdas: { id: string; name: string }[]; statuses: string[]; years: number[];
  verificationStatuses: string[];
};

export async function getExplorerFacets(): Promise<ExplorerFacets> {
  const [states, zones, lgas, sectors, mdas, statuses, years, verificationStatuses] = await env.DB.batch([
    env.DB.prepare("SELECT DISTINCT locations.state FROM locations JOIN projects ON projects.location_id=locations.id WHERE locations.state IS NOT NULL"),
    env.DB.prepare("SELECT DISTINCT locations.senatorial_zone FROM locations JOIN projects ON projects.location_id=locations.id WHERE locations.senatorial_zone IS NOT NULL"),
    env.DB.prepare("SELECT DISTINCT locations.id, locations.name FROM locations JOIN projects ON projects.location_id=locations.id ORDER BY locations.name"),
    env.DB.prepare("SELECT DISTINCT sectors.name, sectors.slug FROM sectors JOIN projects ON projects.sector_id=sectors.id ORDER BY sectors.name"),
    env.DB.prepare("SELECT DISTINCT mdas.id, mdas.name FROM mdas JOIN projects ON projects.mda_id=mdas.id ORDER BY mdas.name"),
    env.DB.prepare("SELECT DISTINCT official_status FROM projects WHERE official_status IS NOT NULL"),
    env.DB.prepare("SELECT DISTINCT budget_year FROM projects ORDER BY budget_year DESC"),
    env.DB.prepare("SELECT DISTINCT verification_status FROM projects WHERE verification_status IS NOT NULL"),
  ]);
  return {
    states: ((states.results ?? []) as { state: string }[]).map((r) => r.state),
    senatorialZones: ((zones.results ?? []) as { senatorial_zone: string }[]).map((r) => r.senatorial_zone),
    lgas: (lgas.results ?? []) as { id: string; name: string }[],
    sectors: (sectors.results ?? []) as { name: string; slug: string }[],
    mdas: (mdas.results ?? []) as { id: string; name: string }[],
    statuses: ((statuses.results ?? []) as { official_status: string }[]).map((r) => r.official_status),
    years: ((years.results ?? []) as { budget_year: number }[]).map((r) => Number(r.budget_year)),
    verificationStatuses: ((verificationStatuses.results ?? []) as { verification_status: string }[]).map((r) => r.verification_status),
  };
}
