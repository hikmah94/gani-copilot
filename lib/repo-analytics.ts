import { env } from "cloudflare:workers";

const JOIN = `FROM projects
  LEFT JOIN sectors ON sectors.id = projects.sector_id
  LEFT JOIN mdas ON mdas.id = projects.mda_id
  LEFT JOIN locations ON locations.id = projects.location_id
  LEFT JOIN documents ON documents.id = projects.source_document_id`;

/** Bidirectional fuzzy match: matches whichever of the DB value or the search term is the shorter substring of the other. */
function fuzzy(
  column: string,
  term: string,
): { clause: string; params: string[] } {
  return {
    clause: `(${column} LIKE ? OR ? LIKE '%' || ${column} || '%')`,
    params: [`%${term}%`, term],
  };
}

export type ToolProjectResult = {
  id: string;
  project_code: string;
  title: string;
  description: string | null;
  approved_amount: number;
  budget_year: number;
  sector_name: string | null;
  mda_name: string | null;
  location_name: string | null;
  capital_or_recurrent: string;
  official_status: string | null;
  verification_status: string;
  source_page: number | null;
  source_reference: string | null;
  source_document_id: string | null;
  document_title: string | null;
  document_type: string | null;
  issuing_authority: string | null;
  document_year: number | null;
  source_url: string | null;
  indexed_at: string | null;
};

export async function searchProjectsByAttributes(args: {
  q?: string;
  location?: string;
  senatorialZone?: string;
  sector?: string;
  mda?: string;
  minAllocation?: number;
  maxAllocation?: number;
  year?: number;
  expenditureType?: string;
  status?: string;
  limit?: number;
}): Promise<{ items: ToolProjectResult[]; total: number }> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (args.q) {
    clauses.push("(projects.title LIKE ? OR projects.description LIKE ?)");
    const like = `%${args.q}%`;
    params.push(like, like);
  }
  if (args.location) {
    const m = fuzzy("locations.name", args.location);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.senatorialZone) {
    const m = fuzzy("locations.senatorial_zone", args.senatorialZone);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.sector) {
    const m = fuzzy("sectors.name", args.sector);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.mda) {
    const m = fuzzy("mdas.name", args.mda);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.minAllocation != null) {
    clauses.push("projects.approved_amount >= ?");
    params.push(args.minAllocation);
  }
  if (args.maxAllocation != null) {
    clauses.push("projects.approved_amount <= ?");
    params.push(args.maxAllocation);
  }
  if (args.year) {
    clauses.push("projects.budget_year = ?");
    params.push(args.year);
  }
  if (args.expenditureType) {
    clauses.push("LOWER(projects.capital_or_recurrent) = LOWER(?)");
    params.push(args.expenditureType);
  }
  if (args.status) {
    clauses.push(
      "(LOWER(COALESCE(projects.official_status,'')) = LOWER(?) OR LOWER(projects.verification_status) = LOWER(?))",
    );
    params.push(args.status, args.status);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 15);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as count ${JOIN}${where}`,
  )
    .bind(...params)
    .first<{ count: number }>();
  const rows = await env.DB.prepare(
    `SELECT projects.id,projects.project_code,projects.title,projects.description,projects.approved_amount,projects.budget_year,projects.capital_or_recurrent,projects.official_status,projects.verification_status,projects.source_page,projects.source_reference,projects.source_document_id,sectors.name as sector_name,mdas.name as mda_name,locations.name as location_name,documents.title AS document_title,documents.document_type,documents.issuing_authority,documents.year AS document_year,documents.original_url AS source_url,documents.indexed_at ${JOIN}${where} ORDER BY projects.approved_amount DESC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<ToolProjectResult>();
  return { items: rows.results ?? [], total: Number(countRow?.count ?? 0) };
}

export async function aggregateBudget(args: {
  sector?: string;
  mda?: string;
  location?: string;
  year?: number;
}): Promise<{ total: number; projectCount: number }> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (args.sector) {
    const m = fuzzy("sectors.name", args.sector);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.mda) {
    const m = fuzzy("mdas.name", args.mda);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.location) {
    const m = fuzzy("locations.name", args.location);
    clauses.push(m.clause);
    params.push(...m.params);
  }
  if (args.year) {
    clauses.push("projects.budget_year = ?");
    params.push(args.year);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const row = await env.DB.prepare(
    `SELECT SUM(projects.approved_amount) as total, COUNT(*) as project_count ${JOIN}${where}`,
  )
    .bind(...params)
    .first<{ total: number | null; project_count: number }>();
  return {
    total: Number(row?.total ?? 0),
    projectCount: Number(row?.project_count ?? 0),
  };
}

export type AggregateMeasure =
  "sum" | "count" | "average" | "minimum" | "maximum";
function referenceFilter(
  idColumn: string,
  nameColumn: string,
  slugColumn: string | null,
  value: string,
) {
  const slug = slugColumn ? ` OR LOWER(${slugColumn})=LOWER(?)` : "";
  return {
    clause: `(${idColumn}=? OR LOWER(${nameColumn})=LOWER(?)${slug})`,
    params: slugColumn ? [value, value, value] : [value, value],
  };
}
export async function aggregateBudgetControlled(args: {
  year?: number;
  governmentId?: string;
  sectorId?: string;
  locationId?: string;
  mdaId?: string;
  expenditureType?: string;
  measure: AggregateMeasure;
}) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (args.year) {
    clauses.push("projects.budget_year=?");
    params.push(args.year);
  }
  if (args.governmentId) {
    clauses.push("mdas.government_id=?");
    params.push(args.governmentId);
  }
  if (args.sectorId) {
    const f = referenceFilter(
      "projects.sector_id",
      "sectors.name",
      "sectors.slug",
      args.sectorId,
    );
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.locationId) {
    const f = referenceFilter(
      "projects.location_id",
      "locations.name",
      null,
      args.locationId,
    );
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.mdaId) {
    const f = referenceFilter("projects.mda_id", "mdas.name", null, args.mdaId);
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.expenditureType) {
    clauses.push("LOWER(projects.capital_or_recurrent)=LOWER(?)");
    params.push(args.expenditureType);
  }
  const expressions: Record<AggregateMeasure, string> = {
    sum: "COALESCE(SUM(projects.approved_amount),0)",
    count: "COUNT(*)",
    average: "COALESCE(AVG(projects.approved_amount),0)",
    minimum: "COALESCE(MIN(projects.approved_amount),0)",
    maximum: "COALESCE(MAX(projects.approved_amount),0)",
  };
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const row = await env.DB.prepare(
    `SELECT ${expressions[args.measure]} AS value, COUNT(*) AS project_count ${JOIN}${where}`,
  )
    .bind(...params)
    .first<{ value: number; project_count: number }>();
  return {
    measure: args.measure,
    value: Number(row?.value ?? 0),
    projectCount: Number(row?.project_count ?? 0),
    unit: args.measure === "count" ? "projects" : "NGN",
  };
}

export async function rankProjects(args: {
  year?: number;
  sectorId?: string;
  locationId?: string;
  mdaId?: string;
  expenditureType?: string;
  order: "highest" | "lowest";
  limit?: number;
}) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (args.year) {
    clauses.push("projects.budget_year=?");
    params.push(args.year);
  }
  if (args.sectorId) {
    const f = referenceFilter(
      "projects.sector_id",
      "sectors.name",
      "sectors.slug",
      args.sectorId,
    );
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.locationId) {
    const f = referenceFilter(
      "projects.location_id",
      "locations.name",
      null,
      args.locationId,
    );
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.mdaId) {
    const f = referenceFilter("projects.mda_id", "mdas.name", null, args.mdaId);
    clauses.push(f.clause);
    params.push(...f.params);
  }
  if (args.expenditureType) {
    clauses.push("LOWER(projects.capital_or_recurrent)=LOWER(?)");
    params.push(args.expenditureType);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const direction = args.order === "lowest" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
  const rows = await env.DB.prepare(
    `SELECT projects.id,projects.project_code,projects.title,projects.description,projects.approved_amount,projects.budget_year,projects.capital_or_recurrent,projects.verification_status,projects.source_page,projects.source_reference,projects.source_document_id,sectors.name AS sector_name,mdas.name AS mda_name,locations.name AS location_name,documents.title AS document_title,documents.document_type,documents.issuing_authority,documents.year AS document_year,documents.original_url AS source_url,documents.indexed_at ${JOIN}${where} ORDER BY projects.approved_amount ${direction},projects.id ASC LIMIT ?`,
  )
    .bind(...params, limit)
    .all();
  return rows.results ?? [];
}

async function dimensionSummary(column: string, id: string, year?: number) {
  const clauses = [`${column}=?`];
  const params: (string | number)[] = [id];
  if (year) {
    clauses.push("projects.budget_year=?");
    params.push(year);
  }
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS project_count,COALESCE(SUM(projects.approved_amount),0) AS total_approved,COALESCE(AVG(projects.approved_amount),0) AS average_approved,COALESCE(SUM(CASE WHEN projects.capital_or_recurrent='Capital' THEN projects.approved_amount ELSE 0 END),0) AS capital,COALESCE(SUM(CASE WHEN projects.capital_or_recurrent='Recurrent' THEN projects.approved_amount ELSE 0 END),0) AS recurrent ${JOIN} WHERE ${clauses.join(" AND ")}`,
  )
    .bind(...params)
    .first();
  return (
    row ?? {
      project_count: 0,
      total_approved: 0,
      average_approved: 0,
      capital: 0,
      recurrent: 0,
    }
  );
}
export async function getSectorSummary(sectorId: string, year?: number) {
  const sector = await env.DB.prepare(
    "SELECT id,name,slug,description FROM sectors WHERE id=?1 OR slug=?1 LIMIT 1",
  )
    .bind(sectorId)
    .first<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
    }>();
  if (!sector) return null;
  return {
    ...sector,
    ...(await dimensionSummary("projects.sector_id", sector.id, year)),
    year: year ?? null,
  };
}
export async function getLocationSummary(locationId: string, year?: number) {
  const location = await env.DB.prepare(
    "SELECT id,name,type,senatorial_zone,state FROM locations WHERE id=?1 LIMIT 1",
  )
    .bind(locationId)
    .first<{
      id: string;
      name: string;
      type: string;
      senatorial_zone: string | null;
      state: string | null;
    }>();
  if (!location) return null;
  return {
    ...location,
    ...(await dimensionSummary("projects.location_id", location.id, year)),
    year: year ?? null,
  };
}

export async function retrieveDocumentChunks(args: {
  documentId: string;
  page?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);
  const query = args.page
    ? "SELECT id,document_id,page,chunk_index,text FROM document_chunks WHERE document_id=?1 AND page=?2 ORDER BY chunk_index LIMIT ?3"
    : "SELECT id,document_id,page,chunk_index,text FROM document_chunks WHERE document_id=?1 ORDER BY chunk_index LIMIT ?2";
  const statement = args.page
    ? env.DB.prepare(query).bind(args.documentId, args.page, limit)
    : env.DB.prepare(query).bind(args.documentId, limit);
  const rows = await statement.all();
  return rows.results ?? [];
}
export async function getDocumentPage(documentId: string, page: number) {
  return retrieveDocumentChunks({ documentId, page, limit: 20 });
}
export async function retrieveEvidence(args: {
  projectId?: string;
  documentId?: string;
  page?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
  if (args.projectId) {
    const rows = await env.DB.prepare(
      "SELECT projects.id,projects.title,projects.approved_amount,projects.source_document_id,projects.source_page,projects.source_reference,documents.title AS document_title,documents.original_url FROM projects LEFT JOIN documents ON documents.id=projects.source_document_id WHERE projects.id=?1 OR projects.project_code=?1 LIMIT ?2",
    )
      .bind(args.projectId, limit)
      .all();
    return rows.results ?? [];
  }
  if (args.documentId)
    return retrieveDocumentChunks({
      documentId: args.documentId,
      page: args.page,
      limit,
    });
  return [];
}

export async function rankMdas(args: {
  year?: number;
  measure?: "allocation" | "project_count";
  order?: "highest" | "lowest";
  limit?: number;
}): Promise<
  { id: string; name: string; total: number; projectCount: number }[]
> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (args.year) {
    clauses.push("projects.budget_year = ?");
    params.push(args.year);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
  const orderBy = args.measure === "project_count" ? "project_count" : "total";
  const direction = args.order === "lowest" ? "ASC" : "DESC";
  const rows = await env.DB.prepare(
    `SELECT mdas.id, mdas.name, SUM(projects.approved_amount) as total, COUNT(*) as project_count FROM projects JOIN mdas ON mdas.id=projects.mda_id${where} GROUP BY mdas.id ORDER BY ${orderBy} ${direction},mdas.name ASC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<{ id: string; name: string; total: number; project_count: number }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    total: Number(r.total),
    projectCount: Number(r.project_count),
  }));
}

export async function compareAllocations(args: {
  sectors: string[];
  year?: number;
}): Promise<
  {
    sector: string;
    total: number;
    projectCount: number;
    shareOfCompared: number;
  }[]
> {
  const results = [];
  for (const sector of args.sectors.slice(0, 5)) {
    const agg = await aggregateBudget({ sector, year: args.year });
    results.push({ sector, total: agg.total, projectCount: agg.projectCount });
  }
  const comparedTotal = results.reduce((sum, item) => sum + item.total, 0);
  return results.map((item) => ({
    ...item,
    shareOfCompared:
      comparedTotal > 0
        ? Math.round((item.total / comparedTotal) * 10000) / 100
        : 0,
  }));
}

export async function rankLocations(args: {
  year?: number;
  sector?: string;
  measure: "allocation" | "project_count";
  order: "highest" | "lowest";
  limit?: number;
}) {
  const clauses: string[] = ["locations.type='LGA'"];
  const params: (string | number)[] = [];
  if (args.year) {
    clauses.push("projects.budget_year=?");
    params.push(args.year);
  }
  if (args.sector) {
    const f = fuzzy("sectors.name", args.sector);
    clauses.push(f.clause);
    params.push(...f.params);
  }
  const where = ` WHERE ${clauses.join(" AND ")}`;
  const orderBy = args.measure === "project_count" ? "project_count" : "total";
  const direction = args.order === "lowest" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
  const rows = await env.DB.prepare(
    `SELECT locations.id,locations.name,locations.senatorial_zone,COUNT(*) AS project_count,COALESCE(SUM(projects.approved_amount),0) AS total ${JOIN}${where} GROUP BY locations.id ORDER BY ${orderBy} ${direction},locations.name ASC LIMIT ?`,
  )
    .bind(...params, limit)
    .all();
  return rows.results ?? [];
}

export async function calculateBudgetShare(args: {
  year?: number;
  sector?: string;
  expenditureType?: string;
}) {
  const numerator = await aggregateBudgetControlled({
    year: args.year,
    sectorId: args.sector,
    expenditureType: args.expenditureType,
    measure: "sum",
  });
  const denominator = await aggregateBudgetControlled({
    year: args.year,
    expenditureType: args.expenditureType,
    measure: "sum",
  });
  const percentage =
    denominator.value > 0 ? (numerator.value / denominator.value) * 100 : null;
  return {
    numerator: numerator.value,
    denominator: denominator.value,
    percentage: percentage === null ? null : Math.round(percentage * 100) / 100,
    sector: args.sector ?? null,
    expenditureType: args.expenditureType ?? null,
    year: args.year ?? null,
    unit: "NGN",
  };
}

export type DocumentPassage = {
  documentId: string;
  documentTitle: string;
  page: number | null;
  snippet: string;
  documentType: string | null;
  issuingAuthority: string | null;
  year: number | null;
  sourceUrl: string | null;
  indexedAt: string | null;
};

export async function searchDocumentPassages(
  q: string,
  limit = 6,
): Promise<DocumentPassage[]> {
  const embedded = (await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [q],
  })) as { data: number[][] };
  const vector = embedded.data?.[0];
  if (!vector) return [];
  const matches = await env.VECTORIZE.query(vector, {
    topK: Math.min(Math.max(limit, 1), 10),
    namespace: "niger-state",
    returnMetadata: "all",
  });
  const ids = matches.matches.map((match) => match.id);
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(",");
  const rows = await env.DB.prepare(
    `SELECT document_chunks.id,document_chunks.document_id,documents.title as document_title,documents.document_type,documents.issuing_authority,documents.year,documents.original_url,documents.indexed_at,document_chunks.page,document_chunks.text FROM document_chunks JOIN documents ON documents.id=document_chunks.document_id WHERE document_chunks.id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{
      id: string;
      document_id: string;
      document_title: string;
      document_type: string | null;
      issuing_authority: string | null;
      year: number | null;
      original_url: string | null;
      indexed_at: string | null;
      page: number | null;
      text: string;
    }>();
  const byId = new Map((rows.results ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [
          {
            documentId: row.document_id,
            documentTitle: row.document_title,
            page: row.page,
            snippet: row.text.slice(0, 1200),
            documentType: row.document_type,
            issuingAuthority: row.issuing_authority,
            year: row.year,
            sourceUrl: row.original_url,
            indexedAt: row.indexed_at,
          },
        ]
      : [];
  });
}
