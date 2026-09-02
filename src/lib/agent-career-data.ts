import { DashboardBranchScope, getDashboardBranchScope } from "@/lib/dashboard-access";
import { supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";

type AgentRow = { agent_id: number; agent_name: string; is_active: boolean };
type BranchRow = { branch_id: number; branch_name: string };
type WeeklyTargetRow = {
  agent_id: number;
  academic_year: string;
  month: string;
  week_start: string;
  branch_id: number | null;
  target_revenue: number | string | null;
};
type RevenueRow = {
  payment_date: string;
  month: string;
  agent_id: number | null;
  branch_id: number | null;
  product_id: number | null;
  is_newtxn: boolean;
  revenue: number | string | null;
  is_bulkbuying: boolean;
};

export type AgentCareerMonth = { id: string; label: string };

export type AgentCareerWeeklyRow = {
  weekStart: string;
  weekEnd: string;
  month: string;
  branch: string;
  branchId: number | null;
  target: number;
  revenue: number;
  achievement: number | null;
  gap: number | null;
  hasTarget: boolean;
};

export type AgentCareerBranchSummary = {
  branch: string;
  firstWeek: string;
  lastWeek: string;
  weeks: number;
  target: number;
  revenue: number;
  achievement: number | null;
};

export type AgentCareerData = {
  agents: { id: string; label: string }[];
  months: AgentCareerMonth[];
  selectedAgent: { id: string; label: string } | null;
  rows: AgentCareerWeeklyRow[];
  branches: AgentCareerBranchSummary[];
  kpis: {
    totalTarget: number;
    totalRevenue: number;
    achievement: number | null;
    weeks: number;
    branchesCovered: number;
    newTransactions: number;
    newTxnBac: number;
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

function monthKey(value: string) {
  const match = value.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const index = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]);
  return Number(match[2]) * 12 + Math.max(index, 0);
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

function branchQuery(scope: DashboardBranchScope, includeUnassigned = false): Record<string, string> {
  if (scope === null) return {};
  if (!scope.length) return { branch_id: "in.(-1)" };
  return includeUnassigned
    ? { or: `(branch_id.in.(${scope.join(",")}),branch_id.is.null)` }
    : { branch_id: `in.(${scope.join(",")})` };
}

function inMonthRange(month: string, fromMonth?: string, toMonth?: string) {
  const value = monthKey(month);
  if (fromMonth && value < monthKey(fromMonth)) return false;
  if (toMonth && value > monthKey(toMonth)) return false;
  return true;
}

const emptyData = (agents: { id: string; label: string }[], months: AgentCareerMonth[]): AgentCareerData => ({
  agents,
  months,
  selectedAgent: null,
  rows: [],
  branches: [],
  kpis: { totalTarget: 0, totalRevenue: 0, achievement: null, weeks: 0, branchesCovered: 0, newTransactions: 0, newTxnBac: 0 },
});

export async function getAgentCareerData({
  agentId,
  fromMonth,
  toMonth,
}: {
  agentId?: number;
  fromMonth?: string;
  toMonth?: string;
} = {}, branchScope?: DashboardBranchScope): Promise<AgentCareerData> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const targetQuery = branchQuery(scope, true);
  const [agents, targetRows, branches] = await Promise.all([
    fetchAll<AgentRow>("t_agent", "agent_id,agent_name,is_active", { is_active: "eq.true" }),
    fetchAll<WeeklyTargetRow>(
      "t_agent_weekly_target",
      "agent_id,academic_year,month,week_start,branch_id,target_revenue",
      targetQuery,
    ),
    fetchAll<BranchRow>("t_branch", "branch_id,branch_name", targetQuery),
  ]);
  const agentOptions = agents
    .map((row) => ({ id: String(row.agent_id), label: row.agent_name }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const monthOptions = Array.from(new Set(targetRows.map((row) => row.month)))
    .sort((left, right) => monthKey(left) - monthKey(right))
    .map((month) => ({ id: month, label: month }));
  const selectedAgent = agentId === undefined
    ? null
    : agentOptions.find((agent) => Number(agent.id) === agentId) ?? null;
  if (!selectedAgent) return emptyData(agentOptions, monthOptions);

  const agentTargets = targetRows.filter((row) => row.agent_id === agentId);
  const selectedTargets = agentTargets.filter((row) =>
    row.agent_id === agentId && inMonthRange(row.month, fromMonth, toMonth),
  );
  const revenueQuery: Record<string, string> = {
    agent_id: `eq.${agentId}`,
    is_bulkbuying: "eq.false",
  };
  const newTxnQuery: Record<string, string> = {
    agent_id: `eq.${agentId}`,
    is_newtxn: "eq.true",
  };
  Object.assign(revenueQuery, branchQuery(scope));
  Object.assign(newTxnQuery, branchQuery(scope));
  const [revenueRows, newTxnRows] = await Promise.all([
    fetchAll<RevenueRow>(
      "t_revenue_txn",
      "payment_date,month,agent_id,branch_id,product_id,is_newtxn,revenue,is_bulkbuying",
      revenueQuery,
    ),
    fetchAll<RevenueRow>(
      "t_revenue_txn",
      "payment_date,month,agent_id,branch_id,product_id,is_newtxn,revenue,is_bulkbuying",
      newTxnQuery,
    ),
  ]);
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const targetByWeek = new Map<string, WeeklyTargetRow>();
  for (const target of agentTargets) {
    targetByWeek.set(target.week_start, target);
  }
  const selectedWeekStarts = new Set(selectedTargets.map((target) => target.week_start));
  let newTransactions = 0;
  let newTxnBac = 0;
  const revenueByWeek = new Map<string, { revenue: number; months: Set<string>; branches: Set<number> }>();
  const isInSelectedPeriod = (row: RevenueRow) => {
    const weekStart = mondayOf(row.payment_date);
    const effectiveMonth = targetByWeek.get(weekStart)?.month ?? row.month;
    if (!inMonthRange(effectiveMonth, fromMonth, toMonth)) return false;
    return !(
      (fromMonth || toMonth) &&
      selectedTargets.length &&
      !selectedWeekStarts.has(weekStart) &&
      targetByWeek.has(weekStart)
    );
  };
  for (const row of revenueRows) {
    const weekStart = mondayOf(row.payment_date);
    if (!isInSelectedPeriod(row)) continue;
    const current = revenueByWeek.get(weekStart) ?? { revenue: 0, months: new Set<string>(), branches: new Set<number>() };
    current.revenue += parseRevenue(row.revenue);
    current.months.add(row.month);
    if (row.branch_id !== null) current.branches.add(row.branch_id);
    revenueByWeek.set(weekStart, current);
  }
  for (const row of newTxnRows) {
    if (!isInSelectedPeriod(row)) continue;
    newTransactions += 1;
    if (row.product_id === 1) newTxnBac += 1;
  }
  const weekStarts = Array.from(new Set([...selectedTargets.map((row) => row.week_start), ...revenueByWeek.keys()])).sort();
  const rows: AgentCareerWeeklyRow[] = weekStarts.map((weekStart) => {
    const target = targetByWeek.get(weekStart);
    const actual = revenueByWeek.get(weekStart);
    const targetValue = target ? parseRevenue(target.target_revenue) : 0;
    const revenue = actual?.revenue ?? 0;
    const branchId = target?.branch_id ?? (actual?.branches.size === 1 ? Array.from(actual.branches)[0] : null);
    const month = target?.month ?? Array.from(actual?.months ?? [""]).sort((left, right) => monthKey(left) - monthKey(right))[0];
    return {
      weekStart,
      weekEnd: sundayAfter(weekStart),
      month,
      branchId,
      branch: branchId === null
        ? actual && actual.branches.size > 1 ? "Multiple branches" : "Unassigned"
        : branchById.get(branchId) ?? `Branch #${branchId}`,
      target: targetValue,
      revenue,
      achievement: targetValue > 0 ? revenue / targetValue : null,
      gap: target ? revenue - targetValue : null,
      hasTarget: Boolean(target),
    };
  });
  const branchGroups = new Map<number | null, AgentCareerBranchSummary>();
  for (const row of rows) {
    const current = branchGroups.get(row.branchId) ?? {
      branch: row.branch,
      firstWeek: row.weekStart,
      lastWeek: row.weekStart,
      weeks: 0,
      target: 0,
      revenue: 0,
      achievement: null,
    };
    current.firstWeek = current.firstWeek < row.weekStart ? current.firstWeek : row.weekStart;
    current.lastWeek = current.lastWeek > row.weekStart ? current.lastWeek : row.weekStart;
    current.weeks += 1;
    current.target += row.target;
    current.revenue += row.revenue;
    current.achievement = current.target > 0 ? current.revenue / current.target : null;
    branchGroups.set(row.branchId, current);
  }
  const totalTarget = rows.reduce((sum, row) => sum + row.target, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return {
    agents: agentOptions,
    months: monthOptions,
    selectedAgent,
    rows,
    branches: Array.from(branchGroups.values()).sort((left, right) => left.firstWeek.localeCompare(right.firstWeek)),
    kpis: {
      totalTarget,
      totalRevenue,
      achievement: totalTarget > 0 ? totalRevenue / totalTarget : null,
      weeks: rows.length,
      branchesCovered: new Set(rows.map((row) => row.branchId).filter((branchId): branchId is number => branchId !== null)).size,
      newTransactions,
      newTxnBac,
    },
  };
}
