import { GitBranch } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { BranchCareerChart } from "@/components/branch-career-chart";
import { BranchCareerFilters } from "@/components/branch-career-filters";
import { BranchCareerTable } from "@/components/branch-career-table";
import { getBranchCareerData } from "@/lib/branch-career-data";
import { getDashboardBranchScope } from "@/lib/dashboard-access";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AllTimeBranchPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const branchIdValue = value("branchId");
  const parsedBranchId = branchIdValue ? Number(branchIdValue) : undefined;
  const branchId = parsedBranchId !== undefined && Number.isSafeInteger(parsedBranchId) ? parsedBranchId : undefined;
  const branchScope = await getDashboardBranchScope();
  const data = await getBranchCareerData({
    branchId,
    fromMonth: value("fromMonth") || undefined,
    toMonth: value("toMonth") || undefined,
  }, branchScope);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">All Time Performance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Branch</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Weekly target and revenue performance across the selected career period.</p>
      </header>
      <BranchCareerFilters
        branches={data.branches}
        months={data.months}
        values={{ branchId: branchIdValue, fromMonth: value("fromMonth"), toMonth: value("toMonth") }}
      />
      {!data.selectedBranch ? (
        <section className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Select a branch to view weekly performance.
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-600">Showing performance for <span className="font-semibold text-slate-900">{data.selectedBranch.label}</span>.</p>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Target" value={formatCurrency(data.kpis.totalTarget)} detail="Selected career period" icon={GitBranch} />
            <MetricCard label="Total Revenue" value={formatCurrency(data.kpis.totalRevenue)} detail="Non-bulk buying revenue" icon={GitBranch} />
            <MetricCard label="Achievement" value={data.kpis.achievement === null ? "-" : formatPercent(data.kpis.achievement)} detail="Total revenue / total target" icon={GitBranch} />
            <MetricCard label="Weeks" value={formatNumber(data.kpis.weeks)} detail="Selected career period" icon={GitBranch} />
          </section>
          <BranchCareerChart rows={data.rows} />
          <BranchCareerTable rows={data.rows} />
        </>
      )}
    </div>
  );
}
