import { env } from "cloudflare:workers";

export type BudgetSummary = {
  year: number;
  analysedBudget: number;
  capitalExpenditure: number;
  recurrentExpenditure: number;
  projectCount: number;
  mdaCount: number;
  sectorCount: number;
  locationCount: number;
};

export async function getBudgetSummary(year: number): Promise<BudgetSummary> {
  const [budgetRow, projectCount, mdaCount, sectorCount, locationCount] = await env.DB.batch([
    env.DB.prepare("SELECT total_budget, capital_expenditure, recurrent_expenditure FROM budgets WHERE budget_year=?1 LIMIT 1").bind(year),
    env.DB.prepare("SELECT COUNT(*) as count FROM projects WHERE budget_year=?1").bind(year),
    env.DB.prepare("SELECT COUNT(DISTINCT mda_id) as count FROM projects WHERE budget_year=?1 AND mda_id IS NOT NULL").bind(year),
    env.DB.prepare("SELECT COUNT(DISTINCT sector_id) as count FROM projects WHERE budget_year=?1 AND sector_id IS NOT NULL").bind(year),
    env.DB.prepare("SELECT COUNT(DISTINCT location_id) as count FROM projects WHERE budget_year=?1 AND location_id IS NOT NULL").bind(year),
  ]);
  const b = budgetRow.results?.[0] as { total_budget?: number; capital_expenditure?: number; recurrent_expenditure?: number } | undefined;
  const count = (r: D1Result<unknown>) => Number((r.results?.[0] as { count?: number } | undefined)?.count ?? 0);
  return {
    year,
    analysedBudget: Number(b?.total_budget ?? 0),
    capitalExpenditure: Number(b?.capital_expenditure ?? 0),
    recurrentExpenditure: Number(b?.recurrent_expenditure ?? 0),
    projectCount: count(projectCount),
    mdaCount: count(mdaCount),
    sectorCount: count(sectorCount),
    locationCount: count(locationCount),
  };
}

export type SectorPreview = { name: string; slug: string; totalAllocation: number; projectCount: number };

export async function getTopSectors(year: number, limit = 5): Promise<SectorPreview[]> {
  const rows = await env.DB.prepare(
    `SELECT sectors.name, sectors.slug, SUM(projects.approved_amount) as total_allocation, COUNT(projects.id) as project_count
     FROM projects JOIN sectors ON sectors.id = projects.sector_id
     WHERE projects.budget_year=?1
     GROUP BY sectors.id ORDER BY total_allocation DESC LIMIT ?2`
  ).bind(year, limit).all<{ name: string; slug: string; total_allocation: number; project_count: number }>();
  return (rows.results ?? []).map((r) => ({ name: r.name, slug: r.slug, totalAllocation: Number(r.total_allocation), projectCount: Number(r.project_count) }));
}

export type SectorAllocation = SectorPreview & { percentage: number };

export async function getSectorAllocations(year: number): Promise<SectorAllocation[]> {
  const sectors = await getTopSectors(year, 100);
  const total = sectors.reduce((sum, s) => sum + s.totalAllocation, 0);
  return sectors.map((s) => ({ ...s, percentage: total > 0 ? Math.round((s.totalAllocation / total) * 1000) / 10 : 0 }));
}

export type CapitalRecurrentSplit = { capital: number; recurrent: number; capitalPercent: number; recurrentPercent: number };

export async function getCapitalRecurrentSplit(year: number): Promise<CapitalRecurrentSplit> {
  const rows = await env.DB.prepare(
    "SELECT capital_or_recurrent, SUM(approved_amount) as total FROM projects WHERE budget_year=?1 GROUP BY capital_or_recurrent"
  ).bind(year).all<{ capital_or_recurrent: string; total: number }>();
  const capital = Number(rows.results?.find((r) => r.capital_or_recurrent === "Capital")?.total ?? 0);
  const recurrent = Number(rows.results?.find((r) => r.capital_or_recurrent === "Recurrent")?.total ?? 0);
  const sum = capital + recurrent;
  return {
    capital, recurrent,
    capitalPercent: sum > 0 ? Math.round((capital / sum) * 1000) / 10 : 0,
    recurrentPercent: sum > 0 ? Math.round((recurrent / sum) * 1000) / 10 : 0,
  };
}

export type LargestProject = { id: string; title: string; approved_amount: number; mda_name: string | null; location_name: string | null; sector_name: string | null };

export async function getLargestProjects(year: number, limit = 10): Promise<LargestProject[]> {
  const rows = await env.DB.prepare(
    `SELECT projects.id, projects.title, projects.approved_amount,
      mdas.name AS mda_name, locations.name AS location_name, sectors.name AS sector_name
     FROM projects
     LEFT JOIN mdas ON mdas.id = projects.mda_id
     LEFT JOIN locations ON locations.id = projects.location_id
     LEFT JOIN sectors ON sectors.id = projects.sector_id
     WHERE projects.budget_year=?1
     ORDER BY projects.approved_amount DESC LIMIT ?2`
  ).bind(year, limit).all<LargestProject>();
  return rows.results ?? [];
}

export type LocationAllocation = { name: string; id: string; projectCount: number; totalAllocation: number };

export async function getLocationAllocations(year: number, limit = 20): Promise<LocationAllocation[]> {
  const rows = await env.DB.prepare(
    `SELECT locations.id, locations.name, COUNT(projects.id) as project_count, SUM(projects.approved_amount) as total_allocation
     FROM projects JOIN locations ON locations.id = projects.location_id
     WHERE projects.budget_year=?1
     GROUP BY locations.id ORDER BY total_allocation DESC LIMIT ?2`
  ).bind(year, limit).all<{ id: string; name: string; project_count: number; total_allocation: number }>();
  return (rows.results ?? []).map((r) => ({ id: r.id, name: r.name, projectCount: Number(r.project_count), totalAllocation: Number(r.total_allocation) }));
}

export async function getGovernmentName(): Promise<string> {
  const row = await env.DB.prepare("SELECT name FROM governments LIMIT 1").first<{ name: string }>();
  return row?.name ?? "Niger State Government";
}
