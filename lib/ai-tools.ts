import { latestBudget } from "@/lib/data";
import { env } from "cloudflare:workers";
import type { EvidenceItem } from "@/lib/evidence";
import { formatMoney } from "@/lib/data";
import {
  aggregateBudgetControlled,
  calculateBudgetShare,
  compareAllocations,
  getDocumentPage,
  getLocationSummary,
  getSectorSummary,
  rankLocations,
  rankMdas,
  rankProjects,
  retrieveDocumentChunks,
  retrieveEvidence,
  searchDocumentPassages,
  searchProjectsByAttributes,
} from "@/lib/repo-analytics";
import { getProjectByIdentifier } from "@/lib/repo-projects";

const GLOSSARY: Record<string, string> = {
  "approved budget":
    "The legal spending authority passed into law for a fiscal year. It is not proof that money was released or spent.",
  "released amount":
    "The amount of an approved allocation that has actually been disbursed by the treasury. It can be lower than the approved allocation, or unavailable if not yet indexed.",
  "capital expenditure":
    "Spending on the acquisition or upgrade of physical assets — roads, buildings, equipment — that create long-term public value.",
  "recurrent expenditure":
    "Day-to-day running costs of government: salaries, overheads, debt service and other operational spending.",
  igr: "Internally Generated Revenue — money a government collects itself (taxes, fees, levies) rather than receiving from the federation account.",
  faac: "The Federation Account Allocation Committee account, from which oil and non-oil revenue collected nationally is shared monthly between federal, state and local governments.",
  "statutory allocation":
    "A state's share of the Federation Account, distributed via FAAC based on national revenue-sharing formulas.",
  mda: "Ministry, Department or Agency — the government body responsible for executing a project or budget line.",
  "verified public record":
    "A project or figure directly traceable to an indexed official government document, with a page and source reference.",
  "community report":
    "An unverified observation submitted by a citizen. It is reviewed before display and never overwrites the official record.",
};

function lookupTerm(term: string): string | null {
  const key = term.trim().toLowerCase();
  if (GLOSSARY[key]) return GLOSSARY[key];
  const partial = Object.entries(GLOSSARY).find(
    ([k]) => key.includes(k) || k.includes(key),
  );
  return partial ? partial[1] : null;
}

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_budget_records",
      description:
        "Query approved annual budget totals from D1. Use for any question about whole-year budget totals, changes, comparisons, or calculations.",
      parameters: {
        type: "object",
        properties: {
          years: {
            type: "array",
            items: { type: "number" },
            description: "Optional budget years; omit for the full series",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_projects",
      description:
        "Search or filter government projects by location (LGA), sector, MDA, allocation range, or free text. Use for project discovery and filtering questions like 'what projects are in X' or 'show projects above ₦Nm in Y'.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "Free text to match against project title or description",
          },
          location: {
            type: "string",
            description: "LGA (local government area) name",
          },
          senatorialZone: {
            type: "string",
            description:
              "Senatorial zone, e.g. Niger North, Niger South, or Niger East",
          },
          sector: {
            type: "string",
            description: "Sector name, e.g. Health, Education, Infrastructure",
          },
          mda: {
            type: "string",
            description: "Ministry, department or agency name",
          },
          minAllocation: {
            type: "number",
            description: "Minimum approved allocation in naira",
          },
          maxAllocation: {
            type: "number",
            description: "Maximum approved allocation in naira",
          },
          year: {
            type: "number",
            description: `Budget year, defaults to ${latestBudget.year} if omitted`,
          },
          expenditureType: {
            type: "string",
            enum: ["Capital", "Recurrent"],
            description: "Budget expenditure classification",
          },
          status: {
            type: "string",
            description: "Official or verification status",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description:
        "Get one project by its controlled database ID or official project code.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Project UUID or official project code",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "aggregate_budget",
      description:
        "Aggregate approved project allocations using a controlled operation: sum, count, average, minimum, or maximum.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          government_id: { type: "string" },
          sector_id: { type: "string" },
          location_id: { type: "string" },
          mda_id: { type: "string" },
          expenditure_type: { type: "string", enum: ["Capital", "Recurrent"] },
          measure: {
            type: "string",
            enum: ["sum", "count", "average", "minimum", "maximum"],
          },
        },
        required: ["measure"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_projects",
      description:
        "Rank projects by approved allocation, highest or lowest, with controlled filters.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          sector_id: { type: "string" },
          location_id: { type: "string" },
          mda_id: { type: "string" },
          expenditure_type: { type: "string", enum: ["Capital", "Recurrent"] },
          order: { type: "string", enum: ["highest", "lowest"] },
          limit: { type: "number" },
        },
        required: ["order"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_mdas",
      description:
        "Rank ministries, departments and agencies (MDAs) by total approved allocation for a given year, highest first. Use for ranking questions like 'which ministry received the most funding'.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          measure: { type: "string", enum: ["allocation", "project_count"] },
          order: { type: "string", enum: ["highest", "lowest"] },
          limit: {
            type: "number",
            description: "Number of MDAs to return, default 10",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_locations",
      description:
        "Rank LGAs or locations by approved allocation or number of projects.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          sector: { type: "string" },
          measure: { type: "string", enum: ["allocation", "project_count"] },
          order: { type: "string", enum: ["highest", "lowest"] },
          limit: { type: "number" },
        },
        required: ["measure", "order"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_budget_share",
      description:
        "Programmatically calculate a sector's percentage share of an expenditure class; the model must use this instead of doing financial arithmetic.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          sector: { type: "string" },
          expenditure_type: { type: "string", enum: ["Capital", "Recurrent"] },
        },
        required: ["sector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sector_summary",
      description:
        "Return verified aggregate statistics for one sector ID or slug.",
      parameters: {
        type: "object",
        properties: { sector_id: { type: "string" }, year: { type: "number" } },
        required: ["sector_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_location_summary",
      description: "Return verified aggregate statistics for one location ID.",
      parameters: {
        type: "object",
        properties: {
          location_id: { type: "string" },
          year: { type: "number" },
        },
        required: ["location_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_allocations",
      description:
        "Compare total approved allocations across two or more sectors for a given year. Use for 'compare X and Y spending' questions.",
      parameters: {
        type: "object",
        properties: {
          sectors: {
            type: "array",
            items: { type: "string" },
            description: "Two or more sector names to compare",
          },
          year: { type: "number" },
        },
        required: ["sectors"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "retrieve_document_chunks",
      description:
        "Retrieve bounded indexed text chunks from a known document, optionally on one page.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          page: { type: "number" },
          limit: { type: "number" },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "retrieve_evidence",
      description:
        "Retrieve source evidence attached to a known project or document.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          document_id: { type: "string" },
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_document_page",
      description:
        "Retrieve indexed public-record text for one exact document page.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          page: { type: "number" },
        },
        required: ["document_id", "page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description:
        "Search indexed budget documents for passages relevant to a topic. Use when the user asks what a document says about something.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_term",
      description:
        "Explain a public-finance or budgeting term such as capital expenditure, recurrent expenditure, approved budget, IGR, FAAC, or MDA.",
      parameters: {
        type: "object",
        properties: { term: { type: "string" } },
        required: ["term"],
      },
    },
  },
];

export type ToolCallRecord = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function integer(v: unknown): number | undefined {
  const value = num(v);
  return value !== undefined && Number.isInteger(value) ? value : undefined;
}
function oneOf<T extends string>(
  v: unknown,
  values: readonly T[],
): T | undefined {
  return typeof v === "string" && values.includes(v as T)
    ? (v as T)
    : undefined;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_budget_records": {
      const years = Array.isArray(args.years)
        ? args.years
            .filter(
              (year): year is number =>
                typeof year === "number" && Number.isInteger(year),
            )
            .slice(0, 10)
        : [];
      const where = years.length
        ? ` WHERE budget_year IN (${years.map((_, i) => `?${i + 1}`).join(",")})`
        : "";
      const rows = await (
        years.length
          ? env.DB.prepare(
              `SELECT budget_year,title,total_budget,status,source_document_id FROM budgets${where} ORDER BY budget_year`,
            ).bind(...years)
          : env.DB.prepare(
              "SELECT budget_year,title,total_budget,status,source_document_id FROM budgets ORDER BY budget_year",
            )
      ).all();
      return { budgets: rows.results };
    }
    case "search_projects": {
      const { items, total } = await searchProjectsByAttributes({
        q: str(args.q),
        location: str(args.location),
        senatorialZone: str(args.senatorialZone),
        sector: str(args.sector),
        mda: str(args.mda),
        minAllocation: num(args.minAllocation),
        maxAllocation: num(args.maxAllocation),
        year: num(args.year),
        expenditureType: str(args.expenditureType),
        status: str(args.status),
      });
      return { total, shown: items.length, projects: items };
    }
    case "get_project": {
      const projectId = str(args.projectId);
      return projectId
        ? { project: await getProjectByIdentifier(projectId) }
        : { error: "projectId is required." };
    }
    case "aggregate_budget": {
      const measure = oneOf(args.measure, [
        "sum",
        "count",
        "average",
        "minimum",
        "maximum",
      ] as const);
      if (!measure) return { error: "Invalid aggregation measure." };
      return await aggregateBudgetControlled({
        year: integer(args.year),
        governmentId: str(args.government_id),
        sectorId: str(args.sector_id),
        locationId: str(args.location_id),
        mdaId: str(args.mda_id),
        expenditureType: oneOf(args.expenditure_type, [
          "Capital",
          "Recurrent",
        ] as const),
        measure,
      });
    }
    case "rank_projects": {
      const order = oneOf(args.order, ["highest", "lowest"] as const);
      if (!order) return { error: "Invalid ranking order." };
      return {
        projects: await rankProjects({
          year: integer(args.year),
          sectorId: str(args.sector_id),
          locationId: str(args.location_id),
          mdaId: str(args.mda_id),
          expenditureType: oneOf(args.expenditure_type, [
            "Capital",
            "Recurrent",
          ] as const),
          order,
          limit: integer(args.limit),
        }),
      };
    }
    case "rank_mdas": {
      return {
        mdas: await rankMdas({
          year: integer(args.year),
          measure: oneOf(args.measure, [
            "allocation",
            "project_count",
          ] as const),
          order: oneOf(args.order, ["highest", "lowest"] as const),
          limit: integer(args.limit),
        }),
      };
    }
    case "rank_locations": {
      const measure = oneOf(args.measure, [
          "allocation",
          "project_count",
        ] as const),
        order = oneOf(args.order, ["highest", "lowest"] as const);
      if (!measure || !order) return { error: "Invalid ranking parameters." };
      return {
        locations: await rankLocations({
          year: integer(args.year),
          sector: str(args.sector),
          measure,
          order,
          limit: integer(args.limit),
        }),
      };
    }
    case "calculate_budget_share": {
      const sector = str(args.sector);
      if (!sector) return { error: "sector is required." };
      return await calculateBudgetShare({
        year: integer(args.year),
        sector,
        expenditureType: oneOf(args.expenditure_type, [
          "Capital",
          "Recurrent",
        ] as const),
      });
    }
    case "compare_allocations": {
      const sectors = Array.isArray(args.sectors)
        ? args.sectors.filter((s): s is string => typeof s === "string")
        : [];
      if (!sectors.length) return { error: "No sectors provided to compare." };
      return {
        comparison: await compareAllocations({ sectors, year: num(args.year) }),
      };
    }
    case "get_sector_summary": {
      const id = str(args.sector_id);
      return id
        ? { sector: await getSectorSummary(id, integer(args.year)) }
        : { error: "sector_id is required." };
    }
    case "get_location_summary": {
      const id = str(args.location_id);
      return id
        ? { location: await getLocationSummary(id, integer(args.year)) }
        : { error: "location_id is required." };
    }
    case "search_documents": {
      const q = str(args.q);
      if (!q) return { error: "No search query provided." };
      const passages = await searchDocumentPassages(q);
      return { passages };
    }
    case "retrieve_document_chunks": {
      const documentId = str(args.document_id);
      return documentId
        ? {
            chunks: await retrieveDocumentChunks({
              documentId,
              page: integer(args.page),
              limit: integer(args.limit),
            }),
          }
        : { error: "document_id is required." };
    }
    case "retrieve_evidence": {
      const projectId = str(args.project_id),
        documentId = str(args.document_id);
      if (!projectId && !documentId)
        return { error: "project_id or document_id is required." };
      return {
        evidence: await retrieveEvidence({
          projectId,
          documentId,
          page: integer(args.page),
          limit: integer(args.limit),
        }),
      };
    }
    case "get_document_page": {
      const documentId = str(args.document_id),
        page = integer(args.page);
      return documentId && page && page > 0
        ? { documentId, page, chunks: await getDocumentPage(documentId, page) }
        : { error: "A valid document_id and positive page are required." };
    }
    case "explain_term": {
      const term = str(args.term) || "";
      const definition = lookupTerm(term);
      return definition
        ? { term, definition }
        : {
            term,
            definition: null,
            note: "No curated definition found — explain using general public-finance knowledge, staying within a civic-budget context.",
          };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function validateToolResult(name: string, result: unknown): unknown {
  const visit = (value: unknown, key = ""): void => {
    if (typeof value === "number") {
      if (!Number.isFinite(value))
        throw new Error(`${name} returned a non-finite number`);
      if (
        /amount|total|approved|numerator|denominator|count/i.test(key) &&
        value < 0
      )
        throw new Error(`${name} returned an invalid negative financial value`);
    } else if (Array.isArray(value)) {
      if (value.length > 100)
        throw new Error(`${name} returned too many records`);
      for (const item of value) visit(item, key);
    } else if (value && typeof value === "object")
      for (const [childKey, child] of Object.entries(value))
        visit(child, childKey);
  };
  visit(result);
  return result;
}

export function toolResultsToEvidence(
  toolCalls: ToolCallRecord[],
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const projectEvidence = (
    p: Record<string, unknown>,
    sourceType: string,
  ): EvidenceItem => ({
    key: `project-${String(p.id ?? p.project_code ?? crypto.randomUUID())}`,
    title: String(p.document_title ?? p.title ?? "Official project record"),
    detail: `${formatMoney(Number(p.approved_amount ?? 0))} · ${String(p.sector_name ?? "Unclassified")} · ${String(p.location_name ?? "Statewide")}`,
    sourceType,
    href: p.id ? `/projects/${String(p.id)}` : undefined,
    verification: String(p.verification_status ?? "verified"),
    documentTitle:
      typeof p.document_title === "string" ? p.document_title : undefined,
    issuingAuthority:
      typeof p.issuing_authority === "string" ? p.issuing_authority : undefined,
    year:
      typeof (p.document_year ?? p.budget_year) === "number"
        ? Number(p.document_year ?? p.budget_year)
        : undefined,
    documentType:
      typeof p.document_type === "string" ? p.document_type : undefined,
    page: typeof p.source_page === "number" ? p.source_page : null,
    section: typeof p.sector_name === "string" ? p.sector_name : undefined,
    passage: typeof p.description === "string" ? p.description : undefined,
    budgetLine:
      typeof p.source_reference === "string"
        ? p.source_reference
        : typeof p.project_code === "string"
          ? p.project_code
          : undefined,
    projectTitle: typeof p.title === "string" ? p.title : undefined,
    approvedAmount:
      typeof p.approved_amount === "number" ? p.approved_amount : undefined,
    sourceUrl: typeof p.source_url === "string" ? p.source_url : undefined,
    indexedAt: typeof p.indexed_at === "string" ? p.indexed_at : undefined,
  });
  for (const call of toolCalls) {
    const result = call.result as Record<string, unknown>;
    if (call.name === "get_budget_records" && Array.isArray(result?.budgets)) {
      for (const budget of result.budgets as {
        budget_year: number;
        title: string;
        total_budget: number;
        source_document_id: string | null;
      }[]) {
        items.push({
          key: `budget-${budget.budget_year}`,
          title: `${budget.budget_year} approved budget: ${formatMoney(budget.total_budget)}`,
          detail: budget.title,
          sourceType: "official-document",
          href: budget.source_document_id
            ? `/documents/${budget.source_document_id}`
            : undefined,
        });
      }
    }
    if (call.name === "search_projects" && Array.isArray(result?.projects)) {
      for (const p of result.projects as Record<string, unknown>[])
        items.push(projectEvidence(p, "verified-project"));
    }
    if (
      call.name === "aggregate_budget" &&
      typeof result?.value === "number" &&
      Number(result.projectCount) > 0
    ) {
      const label =
        [
          call.args.sector_id,
          call.args.mda_id,
          call.args.location_id,
          call.args.expenditure_type,
        ]
          .filter(Boolean)
          .join(", ") || "All projects";
      const value =
        result.measure === "count"
          ? `${result.value} projects`
          : formatMoney(result.value as number);
      items.push({
        key: `agg-${label}-${result.measure}`,
        title: `${String(result.measure)}: ${value}`,
        detail: `${result.projectCount ?? 0} project(s) analysed · ${label}`,
        sourceType: "aggregate-query",
      });
    }
    if (
      call.name === "get_project" &&
      result?.project &&
      typeof result.project === "object"
    )
      items.push(
        projectEvidence(
          result.project as Record<string, unknown>,
          "verified-project",
        ),
      );
    if (call.name === "rank_projects" && Array.isArray(result?.projects)) {
      for (const p of (result.projects as Record<string, unknown>[]).slice(
        0,
        10,
      ))
        items.push(projectEvidence(p, "aggregate-query"));
    }
    if (call.name === "rank_mdas" && Array.isArray(result?.mdas)) {
      for (const m of (
        result.mdas as {
          id: string;
          name: string;
          total: number;
          projectCount: number;
        }[]
      ).slice(0, 5)) {
        items.push({
          key: `mda-${m.id}`,
          title: `${m.name}: ${formatMoney(m.total)}`,
          detail: `${m.projectCount} project(s)`,
          sourceType: "aggregate-query",
          href: `/projects?mda=${m.id}`,
        });
      }
    }
    if (call.name === "rank_locations" && Array.isArray(result?.locations)) {
      for (const location of (
        result.locations as {
          id: string;
          name: string;
          total: number;
          project_count: number;
        }[]
      ).slice(0, 10))
        items.push({
          key: `location-rank-${location.id}`,
          title: `${location.name}: ${formatMoney(location.total)}`,
          detail: `${location.project_count} project(s)`,
          sourceType: "aggregate-query",
          href: `/projects?location=${location.id}`,
        });
    }
    if (
      call.name === "calculate_budget_share" &&
      typeof result?.numerator === "number" &&
      Number(result.denominator) > 0
    ) {
      items.push({
        key: `share-${String(result.sector)}-${String(result.year)}`,
        title: `${String(result.sector)} share: ${result.percentage === null ? "Unavailable" : `${result.percentage}%`}`,
        detail: `${formatMoney(result.numerator as number)} of ${formatMoney(result.denominator as number)} ${String(result.expenditureType ?? "total")} expenditure`,
        sourceType: "aggregate-query",
      });
    }
    if (
      call.name === "compare_allocations" &&
      Array.isArray(result?.comparison)
    ) {
      for (const c of (
        result.comparison as {
          sector: string;
          total: number;
          projectCount: number;
        }[]
      ).filter((item) => item.projectCount > 0 || item.total > 0)) {
        items.push({
          key: `cmp-${c.sector}`,
          title: `${c.sector}: ${formatMoney(c.total)}`,
          detail: `${c.projectCount} project(s) analysed`,
          sourceType: "aggregate-query",
        });
      }
    }
    if (call.name === "search_documents" && Array.isArray(result?.passages)) {
      for (const p of result.passages as {
        documentId: string;
        documentTitle: string;
        page: number | null;
        snippet: string;
      }[]) {
        items.push({
          key: `doc-${p.documentId}-${p.page}`,
          title: p.documentTitle,
          detail: `${p.page ? `Page ${p.page} · ` : ""}${p.snippet}`,
          sourceType: "official-document",
          href: `/documents/${p.documentId}`,
        });
      }
    }
    if (
      (call.name === "retrieve_document_chunks" ||
        call.name === "get_document_page") &&
      Array.isArray(result?.chunks)
    ) {
      for (const chunk of (
        result.chunks as {
          id: string;
          document_id: string;
          page: number | null;
          text: string;
        }[]
      ).slice(0, 10))
        items.push({
          key: `chunk-${chunk.id}`,
          title: `Document page ${chunk.page ?? "unknown"}`,
          detail: chunk.text.slice(0, 1200),
          sourceType: "official-document",
          href: `/documents/${chunk.document_id}`,
        });
    }
    if (call.name === "retrieve_evidence" && Array.isArray(result?.evidence)) {
      for (const record of (result.evidence as Record<string, unknown>[]).slice(
        0,
        10,
      )) {
        const id = String(
          record.id ?? record.document_id ?? crypto.randomUUID(),
        );
        items.push({
          key: `evidence-${id}-${String(record.source_page ?? record.page ?? "")}`,
          title: String(
            record.title ?? record.document_title ?? "Official evidence",
          ),
          detail: String(
            record.source_reference ?? record.text ?? "Source record",
          ),
          sourceType: "official-document",
          href: record.source_document_id
            ? `/documents/${String(record.source_document_id)}`
            : record.document_id
              ? `/documents/${String(record.document_id)}`
              : undefined,
        });
      }
    }
  }
  return items;
}
