import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { BudgetDashboard } from "@/components/budget-dashboard";
import { budgets } from "@/lib/data";

export default async function BudgetYear({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  const years = budgets.map((b) => b.year).slice().reverse();
  if (!Number.isInteger(year) || !years.includes(year)) notFound();

  return <Shell>
    <section className="page-hero">
      <span className="kicker">Budget intelligence</span>
      <h1>{year} budget dashboard</h1>
      <p>A single-year breakdown of Niger State&apos;s analysed spending.</p>
    </section>
    <section className="content" style={{ paddingTop: 0 }}>
      <BudgetDashboard year={year} availableYears={years} />
    </section>
  </Shell>;
}
