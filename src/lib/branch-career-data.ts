import { DashboardBranchScope, getDashboardBranchScope } from "@/lib/dashboard-access";
import { supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";

type BranchRow = { branch_id: number; branch_name: string };
type BranchWeeklyTargetRow = {
  month: string;
  week_start: string;
  branch_id: number;
  target_revenue: number | string | null;
};
type RevenueRow = {
  payment_date: string;
  month: string;
  branch_id: number | null;
  revenue: number | string | null;
  is_bulkbuying: boolean;
};

export type BranchCareerMonth = { id: string; label: string };

export type BranchCareerWeeklyRow = {
  weekStart: string;
  weekEnd: string;
  month: string;
  academicYear: string;
  target: number;
  revenue: number;
  lyRevenue: number;
  achievement: number | null;
  hasTarget: boolean;
};

export type BranchCareerData = {
  branches: { id: string; label: string }[];
  months: BranchCareerMonth[];
  selectedBranch: { id: string; label: string } | null;
  rows: BranchCareerWeeklyRow[];
  kpis: {
    totalTarget: number;
    totalRevenue: number;
    achievement: number | null;
    weeks: number;
  };
};

const fetchInit: SupabaseFetchInit = {
  next: { revalidate: 30, tags: ["revenue-dashboard", "agent-weekly-targets"] },
};

async function fetchAll<T>(table: string, select: string, query: Record<string, string> = {}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({ select, limit: "1000", offset: String(offset), ...query });
    const response = await supabaseRestFetch(`${table}?${params.toString()}`, fetchInit);
    if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function parseRevenue(value: number | string | null) {
  return Number(value ?? 0) || 0;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function canonicalMonth(value: string) {
  const match = value.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = monthNames.find((item) => item.toLowerCase() === match[1].toLowerCase());
  return month ? `${month} ${match[2]}` : null;
}

function monthKey(value: string) {
  const normalized = canonicalMonth(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const [month, year] = normalized.split(" ");
  return Number(year) * 12 + monthNames.indexOf(month);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mondayOf(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formatDate(date);
}

function sundayAfter(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return formatDate(date);
}

function shiftWeekYear(value: string, years: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return mondayOf(formatDate(date));
}

function academicYearFromMonth(value: string) {
  const normalized = canonicalMonth(value);
  if (!normalized) return "-";
  const [month, yearValue] = normalized.split(" ");
  const year = Number(yearValue);
  const startYear = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].includes(month) ? year : year - 1;
  return `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function inMonthRange(month: string, fromMonth?: string, toMonth?: string) {
  const value = monthKey(month);
  if (!Number.isFinite(value)) return false;
  if (fromMonth && value < monthKey(fromMonth)) return false;
  if (toMonth && value > monthKey(toMonth)) return false;
  return true;
}

function branchQuery(scope: DashboardBranchScope): Record<string, string> {
  if (scope === null) return { branch_id: "not.is.null" };
  return scope.length ? { branch_id: `in.(${scope.join(",")})` } : { branch_id: "in.(-1)" };
}

const emptyData = (branches: { id: string; label: string }[], months: BranchCareerMonth[]): BranchCareerData => ({
  branches,
  months,
  selectedBranch: null,
  rows: [],
  kpis: { totalTarget: 0, totalRevenue: 0, achievement: null, weeks: 0 },
});

export async function getBranchCareerData({
  branchId,
  fromMonth,
  toMonth,
}: {
  branchId?: number;
  fromMonth?: string;
  toMonth?: string;
} = {}, branchScope?: DashboardBranchScope): Promise<BranchCareerData> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const scopedBranchQuery = branchQuery(scope);
  const [branches, branchWeeklyTargetRows, revenueRows] = await Promise.all([
    fetchAll<BranchRow>("t_branch", "branch_id,branch_name", scopedBranchQuery),
    fetchAll<BranchWeeklyTargetRow>(
      "t_branch_weekly_target",
      "month,week_start,branch_id,target_revenue",
      scopedBranchQuery,
    ),
    fetchAll<RevenueRow>(
      "t_revenue_txn",
      "payment_date,month,branch_id,revenue,is_bulkbuying",
      { ...scopedBranchQuery, is_bulkbuying: "eq.false" },
    ),
  ]);

  const branchOptions = branches
    .filter((row) => row.branch_id !== 100)
    .map((row) => ({ id: String(row.branch_id), label: row.branch_name }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const allMonthOptions = Array.from(new Set([
    ...branchWeeklyTargetRows.map((row) => canonicalMonth(row.month)),
    ...revenueRows.map((row) => canonicalMonth(row.month)),
  ].filter((month): month is string => Boolean(month))))
    .sort((left, right) => monthKey(left) - monthKey(right))
    .map((month) => ({ id: month, label: month }));
  const monthOptions = allMonthOptions.slice(-15);
  const visibleMonths = new Set(monthOptions.map((month) => month.id));
  const isVisibleMonth = (month: string) => visibleMonths.has(month);
  const selectedBranch = branchId === undefined
    ? null
    : branchOptions.find((branch) => Number(branch.id) === branchId) ?? null;
  if (!selectedBranch) return emptyData(branchOptions, monthOptions);

  const targetByWeek = new Map<string, { month: string; target: number }>();
  for (const row of branchWeeklyTargetRows) {
    if (row.branch_id !== branchId) continue;
    const month = canonicalMonth(row.month);
    if (!month || !isVisibleMonth(month) || !inMonthRange(month, fromMonth, toMonth)) continue;
    const current = targetByWeek.get(row.week_start);
    targetByWeek.set(row.week_start, {
      month,
      target: (current?.target ?? 0) + parseRevenue(row.target_revenue),
    });
  }

  const revenueByWeek = new Map<string, number>();
  const revenueMonthByWeek = new Map<string, Set<string>>();
  for (const row of revenueRows) {
    if (row.branch_id !== branchId) continue;
    const month = canonicalMonth(row.month);
    if (!month) continue;
    const weekStart = mondayOf(row.payment_date);
    revenueByWeek.set(weekStart, (revenueByWeek.get(weekStart) ?? 0) + parseRevenue(row.revenue));
    const months = revenueMonthByWeek.get(weekStart) ?? new Set<string>();
    months.add(month);
    revenueMonthByWeek.set(weekStart, months);
  }

  const revenueWeekMonth = (weekStart: string) => {
    const targetMonth = targetByWeek.get(weekStart)?.month;
    if (targetMonth) return targetMonth;
    return Array.from(revenueMonthByWeek.get(weekStart) ?? []).sort((left, right) => monthKey(left) - monthKey(right))[0] ?? null;
  };
  const selectedWeeks = Array.from(new Set([
    ...targetByWeek.keys(),
    ...Array.from(revenueByWeek.keys()).filter((weekStart) => {
      const month = revenueWeekMonth(weekStart);
      return month !== null && isVisibleMonth(month) && inMonthRange(month, fromMonth, toMonth);
    }),
  ])).sort();
  const rows: BranchCareerWeeklyRow[] = selectedWeeks.map((weekStart) => {
    const month = revenueWeekMonth(weekStart) ?? targetByWeek.get(weekStart)?.month ?? "-";
    const target = targetByWeek.get(weekStart)?.target ?? 0;
    const revenue = revenueByWeek.get(weekStart) ?? 0;
    const lyRevenue = revenueByWeek.get(shiftWeekYear(weekStart, -1)) ?? 0;
    return {
      weekStart,
      weekEnd: sundayAfter(weekStart),
      month,
      academicYear: academicYearFromMonth(month),
      target,
      revenue,
      lyRevenue,
      achievement: target > 0 ? revenue / target : null,
      hasTarget: targetByWeek.has(weekStart),
    };
  });
  const totalTarget = rows.reduce((sum, row) => sum + row.target, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return {
    branches: branchOptions,
    months: monthOptions,
    selectedBranch,
    rows,
    kpis: {
      totalTarget,
      totalRevenue,
      achievement: totalTarget > 0 ? totalRevenue / totalTarget : null,
      weeks: rows.length,
    },
  };
}
