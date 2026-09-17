import { UsersRound } from "lucide-react";
import { AgentFilters } from "@/components/agent-filters";
import { AgentPerformanceTable } from "@/components/agent-performance-table";
import { LatestTransactionDate } from "@/components/latest-transaction-date";
import { getAgentAnalytics, getAgentProductRevenue } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getLatestRevenuePeriodContext, getLatestTransactionDate } from "@/lib/revenue-filters";
import { supabaseRestFetch } from "@/lib/supabase-server";
import { getDashboardBranchScope } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

function countWeekdays(fromDate: string, toDate: string) {
  if (!fromDate || !toDate || fromDate > toDate) return 0;

  const start = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  let weekdays = 0;

  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
  }

  return weekdays;
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const numericValue = (key: string) => {
    const raw = value(key);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const branchScope = await getDashboardBranchScope();
  const branchParams = new URLSearchParams({
    select: "branch_id,branch_name,region_id",
    region_id: "not.is.null",
    order: "branch_name",
    limit: "1000",
  });
  if (branchScope !== null) {
    if (!branchScope.length) branchParams.set("branch_id", "in.(-1)");
    else branchParams.set("branch_id", `in.(${branchScope.join(",")})`);
  }
  const regionParams = new URLSearchParams({
    select: "region_id,region_name",
    order: "region_name",
    limit: "1000",
  });
  const [periodContext, branchesResponse, regionsResponse] = await Promise.all([
    getLatestRevenuePeriodContext(branchScope),
    supabaseRestFetch(`t_branch?${branchParams.toString()}`),
    supabaseRestFetch(`t_region?${regionParams.toString()}`),
  ]);
  const branches = branchesResponse.ok
    ? ((await branchesResponse.json()) as { branch_id: number; branch_name: string; region_id: number | null }[]).map((row) => ({ id: String(row.branch_id), label: row.branch_name, regionId: String(row.region_id ?? "") }))
    : [];
  const availableRegionIds = new Set(branches.map((branch) => branch.regionId).filter(Boolean));
  const regions = regionsResponse.ok
    ? ((await regionsResponse.json()) as { region_id: number; region_name: string }[])
      .filter((row) => availableRegionIds.has(String(row.region_id)))
      .map((row) => ({ id: String(row.region_id), label: row.region_name }))
    : [];
  const academicYear = periodContext.academicYear ?? "";
  const requestedMonth = value("month");
  const month = periodContext.months.some((option) => option.id === requestedMonth)
    ? requestedMonth
    : "";
  const productivityFromDate = periodContext.startDate || "";
  const productivityToDate = periodContext.latestPaymentDate || "";
  const productivityWeekdays = countWeekdays(productivityFromDate, productivityToDate);
  const analyticsFilters = {
    academicYear,
    regionId: numericValue("regionId"),
    branchId: numericValue("branchId"),
    month: month || undefined,
  };
  const [rows, productRevenue, latestTransactionDate] = await Promise.all([
    getAgentAnalytics(analyticsFilters, branchScope),
    getAgentProductRevenue(analyticsFilters, branchScope),
    getLatestTransactionDate(branchScope, {
      regionId: numericValue("regionId"),
      branchId: numericValue("branchId"),
      month: month || undefined,
    }),
  ]);
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Revenue Overview</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Agent Productivity</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Revenue from new transactions and non-bulk-buying transactions for academic year {academicYear || "-"}.
        </p>
      </header>
      <AgentFilters
        branches={branches}
        regions={regions}
        months={periodContext.months.map((option) => option.id)}
        values={{
          regionId: value("regionId"),
          branchId: value("branchId"),
          month,
        }}
      />
      <LatestTransactionDate date={latestTransactionDate} label="Latest transaction date for current selection" />
      <AgentPerformanceTable
        data={rows}
        productRevenue={productRevenue}
        productivityWeekdays={productivityWeekdays}
        showRevenuePerNewTxn
      />
      <p className="text-xs text-slate-500">{formatNumber(rows.length)} agents have revenue in the selected academic year.</p>
    </div>
  );
}
