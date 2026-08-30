import { UsersRound } from "lucide-react";
import { AgentFilters } from "@/components/agent-filters";
import { AgentPerformanceTable } from "@/components/agent-performance-table";
import { getAgentAnalytics } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getLatestRevenuePeriodContext } from "@/lib/revenue-filters";
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
  const branchScope = await getDashboardBranchScope();
  const branchParams = new URLSearchParams({
    select: "branch_id,branch_name",
    region_id: "not.is.null",
    order: "branch_name",
    limit: "1000",
  });
  if (branchScope !== null) {
    if (!branchScope.length) branchParams.set("branch_id", "in.(-1)");
    else branchParams.set("branch_id", `in.(${branchScope.join(",")})`);
  }
  const [periodContext, branchesResponse] = await Promise.all([
    getLatestRevenuePeriodContext(branchScope),
    supabaseRestFetch(`t_branch?${branchParams.toString()}`),
  ]);
  const branches = branchesResponse.ok
    ? ((await branchesResponse.json()) as { branch_id: number; branch_name: string }[]).map((row) => ({ id: String(row.branch_id), label: row.branch_name }))
    : [];
  const academicYear = periodContext.academicYear ?? "";
  const requestedMonth = value("month");
  const month = periodContext.months.some((option) => option.id === requestedMonth)
    ? requestedMonth
    : "";
  const selectedFromDate = value("fromDate");
  const selectedToDate = value("toDate");
  const productivityFromDate = selectedFromDate || periodContext.startDate || "";
  const productivityToDate = selectedToDate || periodContext.latestPaymentDate || "";
  const productivityWeekdays = countWeekdays(productivityFromDate, productivityToDate);
  const rows = await getAgentAnalytics({
    academicYear,
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
    month: month || undefined,
    fromDate: selectedFromDate || undefined,
    toDate: selectedToDate || undefined,
  }, branchScope);
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
        months={periodContext.months.map((option) => option.id)}
        values={{
          branchId: value("branchId"),
          month,
          fromDate: value("fromDate"),
          toDate: value("toDate"),
        }}
      />
      <AgentPerformanceTable
        data={rows}
        productivityWeekdays={productivityWeekdays}
        showRevenuePerNewTxn
      />
      <p className="text-xs text-slate-500">{formatNumber(rows.length)} agents have revenue in the selected academic year.</p>
    </div>
  );
}
