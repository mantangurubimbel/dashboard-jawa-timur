import { UsersRound } from "lucide-react";
import { AgentFilters } from "@/components/agent-filters";
import { AgentPerformanceTable } from "@/components/agent-performance-table";
import { getAgentAnalytics } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";
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

function academicYearStartDate(academicYear: string) {
  const match = academicYear.match(/^(\d{2})\/\d{2}$/);
  return match ? `20${match[1]}-07-01` : "";
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
  const [academicYears, branchesResponse] = await Promise.all([
    getRevenueAcademicYearOptions(),
    supabaseRestFetch(`t_branch?${branchParams.toString()}`),
  ]);
  const branches = branchesResponse.ok
    ? ((await branchesResponse.json()) as { branch_id: number; branch_name: string }[]).map((row) => ({ id: String(row.branch_id), label: row.branch_name }))
    : [];
  const academicYear = academicYears.some((year) => year.id === value("academicYear"))
    ? value("academicYear")
    : academicYears[0]?.id ?? "";
  const selectedFromDate = value("fromDate");
  const selectedToDate = value("toDate");
  const latestTxnResponse = await supabaseRestFetch(
    (() => {
      const params = new URLSearchParams({
        select: "payment_date",
        academic_year: `eq.${academicYear}`,
        order: "payment_date.desc",
        limit: "1",
      });
      if (branchScope !== null) params.set("branch_id", branchScope.length ? `in.(${branchScope.join(",")})` : "in.(-1)");
      return `t_revenue_txn?${params.toString()}`;
    })(),
  );
  const latestTxnRows = latestTxnResponse.ok
    ? ((await latestTxnResponse.json()) as { payment_date: string }[])
    : [];
  const latestAcademicYearDate = latestTxnRows[0]?.payment_date ?? "";
  const productivityFromDate = selectedFromDate || academicYearStartDate(academicYear);
  const productivityToDate = selectedToDate || latestAcademicYearDate;
  const productivityWeekdays = countWeekdays(productivityFromDate, productivityToDate);
  const rows = await getAgentAnalytics({
    academicYear,
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
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
        <p className="mt-2 text-sm text-slate-600">Revenue from new txn and non bulk buying transaction</p>
      </header>
      <AgentFilters
        academicYears={academicYears.map((year) => year.id)}
        branches={branches}
        values={{
          academicYear,
          branchId: value("branchId"),
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
