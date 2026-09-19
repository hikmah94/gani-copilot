import { env } from "cloudflare:workers";

export type DocumentSummary = {
  id: string;
  title: string;
  document_type: string;
  year: number;
  issuing_authority: string;
  processing_status: string;
  page_count: number | null;
  original_url: string | null;
  r2_key: string | null;
  indexed_at: string | null;
  government_id: string | null;
  government_name: string | null;
  project_count: number;
};

export async function listDocuments(limit = 50): Promise<DocumentSummary[]> {
  const rows = await env.DB.prepare(
    "SELECT documents.id,documents.title,documents.document_type,documents.year,documents.issuing_authority,documents.processing_status,documents.page_count,documents.original_url,documents.r2_key,documents.indexed_at,documents.government_id,governments.name AS government_name,(SELECT COUNT(*) FROM projects WHERE projects.source_document_id=documents.id) AS project_count FROM documents LEFT JOIN governments ON governments.id=documents.government_id ORDER BY documents.year DESC,documents.title LIMIT ?1",
  )
    .bind(limit)
    .all<DocumentSummary>();
  return rows.results ?? [];
}

export type DocumentFilters = {
  q?: string;
  year?: number;
  government?: string;
  documentType?: string;
  authority?: string;
  status?: string;
};
export type DocumentFacets = {
  years: number[];
  governments: { id: string; name: string }[];
  documentTypes: string[];
  authorities: string[];
  statuses: string[];
};

export async function getDocumentFacets(): Promise<DocumentFacets> {
  const [years, governments, types, authorities, statuses] = await env.DB.batch(
    [
      env.DB.prepare("SELECT DISTINCT year FROM documents ORDER BY year DESC"),
      env.DB.prepare(
        "SELECT DISTINCT governments.id,governments.name FROM governments JOIN documents ON documents.government_id=governments.id ORDER BY governments.name",
      ),
      env.DB.prepare(
        "SELECT DISTINCT document_type FROM documents ORDER BY document_type",
      ),
      env.DB.prepare(
        "SELECT DISTINCT issuing_authority FROM documents ORDER BY issuing_authority",
      ),
      env.DB.prepare(
        "SELECT DISTINCT processing_status FROM documents ORDER BY processing_status",
      ),
    ],
  );
  return {
    years: (years.results as { year: number }[]).map((row) => Number(row.year)),
    governments: governments.results as { id: string; name: string }[],
    documentTypes: (types.results as { document_type: string }[]).map(
      (row) => row.document_type,
    ),
    authorities: (authorities.results as { issuing_authority: string }[]).map(
      (row) => row.issuing_authority,
    ),
    statuses: (statuses.results as { processing_status: string }[]).map(
      (row) => row.processing_status,
    ),
  };
}

export async function searchDocuments(
  filters: DocumentFilters,
): Promise<DocumentSummary[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.q) {
    clauses.push(
      "(documents.title LIKE ? OR documents.issuing_authority LIKE ? OR documents.document_type LIKE ? OR CAST(documents.year AS TEXT) LIKE ?)",
    );
    const like = "%" + filters.q + "%";
    params.push(like, like, like, like);
  }
  if (filters.year) {
    clauses.push("documents.year=?");
    params.push(filters.year);
  }
  if (filters.government) {
    clauses.push("documents.government_id=?");
    params.push(filters.government);
  }
  if (filters.documentType) {
    clauses.push("documents.document_type=?");
    params.push(filters.documentType);
  }
  if (filters.authority) {
    clauses.push("documents.issuing_authority=?");
    params.push(filters.authority);
  }
  if (filters.status) {
    clauses.push("documents.processing_status=?");
    params.push(filters.status);
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const sql =
    "SELECT documents.id,documents.title,documents.document_type,documents.year,documents.issuing_authority,documents.processing_status,documents.page_count,documents.original_url,documents.r2_key,documents.indexed_at,documents.government_id,governments.name AS government_name,(SELECT COUNT(*) FROM projects WHERE projects.source_document_id=documents.id) AS project_count FROM documents LEFT JOIN governments ON governments.id=documents.government_id" +
    where +
    " ORDER BY documents.year DESC,documents.title LIMIT 100";
  const rows = await env.DB.prepare(sql)
    .bind(...params)
    .all<DocumentSummary>();
  return rows.results ?? [];
}

export type DocumentDetail = DocumentSummary & {
  publication_date: string | null;
  checksum: string | null;
  chunk_count: number;
  mda_count: number;
  sector_count: number;
};

export async function getDocumentById(
  id: string,
): Promise<DocumentDetail | null> {
  const doc = await env.DB.prepare(
    "SELECT documents.id,documents.title,documents.document_type,documents.year,documents.issuing_authority,documents.processing_status,documents.page_count,documents.original_url,documents.r2_key,documents.indexed_at,documents.publication_date,documents.checksum,documents.government_id,governments.name AS government_name,(SELECT COUNT(*) FROM projects WHERE projects.source_document_id=documents.id) AS project_count FROM documents LEFT JOIN governments ON governments.id=documents.government_id WHERE documents.id=?1",
  )
    .bind(id)
    .first<
      DocumentSummary & {
        publication_date: string | null;
        checksum: string | null;
      }
    >();
  if (!doc) return null;
  const chunkCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM document_chunks WHERE document_id=?1",
  )
    .bind(id)
    .first<{ count: number }>();
  const dimensions = await env.DB.prepare(
    "SELECT COUNT(DISTINCT mda_id) AS mda_count,COUNT(DISTINCT sector_id) AS sector_count FROM projects WHERE source_document_id=?1",
  )
    .bind(id)
    .first<{ mda_count: number; sector_count: number }>();
  return {
    ...doc,
    chunk_count: Number(chunkCount?.count ?? 0),
    mda_count: Number(dimensions?.mda_count ?? 0),
    sector_count: Number(dimensions?.sector_count ?? 0),
  };
}

export type ChunkPreview = { page: number | null; text: string };

export async function getDocumentChunksPreview(
  id: string,
  limit = 3,
): Promise<ChunkPreview[]> {
  const rows = await env.DB.prepare(
    "SELECT page, text FROM document_chunks WHERE document_id=?1 ORDER BY chunk_index ASC LIMIT ?2",
  )
    .bind(id, limit)
    .all<ChunkPreview>();
  return rows.results ?? [];
}

export async function getDocumentChunksForContext(
  id: string,
  limit = 40,
): Promise<ChunkPreview[]> {
  const rows = await env.DB.prepare(
    "SELECT page, text FROM document_chunks WHERE document_id=?1 ORDER BY chunk_index ASC LIMIT ?2",
  )
    .bind(id, limit)
    .all<ChunkPreview>();
  return rows.results ?? [];
}
