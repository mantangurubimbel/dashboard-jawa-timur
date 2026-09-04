import { supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";

export type SettingsTargetKind = "annual" | "monthly" | "agent_weekly" | "branch_weekly";

export type SettingsTargetRecord = {
  id: string;
  kind: SettingsTargetKind;
  academicYear: string;
  month: string;
  weekStart: string | null;
  branchId: number | null;
  branchName: string;
  agentId: number | null;
  agentName: string;
  targetRevenue: number;
  updatedAt: string;
};

export type SettingsTargetData = {
  activeAcademicYear: string | null;
  latestTransactionMonth: string | null;
  months: string[];
  branches: { id: number; name: string }[];
  records: SettingsTargetRecord[];
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

async function fetchFirst<T>(table: string, select: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ select, limit: "1", ...query });
  const response = await supabaseRestFetch(`${table}?${params.toString()}`, fetchInit);
  if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
  return ((await response.json()) as T[])[0] ?? null;
}

function parseRevenue(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

const calendarMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const academicMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function canonicalMonth(value: string | null | undefined) {
  const match = String(value ?? "").trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = calendarMonths.find((item) => item.toLowerCase() === match[1].toLowerCase());
  return month ? `${month} ${match[2]}` : null;
}

function monthKey(value: string) {
  const normalized = canonicalMonth(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const [month, year] = normalized.split(" ");
  return Number(year) * 12 + calendarMonths.indexOf(month);
}

function academicStartYear(value: string) {
  const short = value.match(/^(\d{2})\/(\d{2})$/);
  if (short) return 2000 + Number(short[1]);
  const long = value.match(/^(\d{4})\/(?:\d{4})$/);
  return long ? Number(long[1]) : null;
}

function monthLabelForAcademicYear(index: number, academicYear: string) {
  const startYear = academicStartYear(academicYear);
  if (startYear === null) return academicMonths[index] ?? "-";
  const month = academicMonths[index];
  const year = index < 6 ? startYear : startYear + 1;
  return `${month} ${year}`;
}

function isMonthInAcademicYear(month: string, academicYear: string) {
  const startYear = academicStartYear(academicYear);
  const normalized = canonicalMonth(month);
  if (startYear === null || !normalized) return false;
  const key = monthKey(normalized);
  return key >= startYear * 12 + 6 && key <= (startYear + 1) * 12 + 5;
}

function latestMonthForAcademicYear(academicYear: string, candidates: string[], latestTransactionMonth: string | null) {
  const validCandidates = candidates.filter((month) => isMonthInAcademicYear(month, academicYear));
  if (latestTransactionMonth && isMonthInAcademicYear(latestTransactionMonth, academicYear)) return latestTransactionMonth;
  return validCandidates.sort((left, right) => monthKey(right) - monthKey(left))[0] ?? null;
}

export async function getSettingsTargetData(): Promise<SettingsTargetData> {
  const [activeYearRow, latestTransaction, branches, agents, annualRows, branchWeeklyRows, agentWeeklyRows] = await Promise.all([
    fetchFirst<{ academic_year: string }>("t_academic_year", "academic_year", { is_active: "eq.true", order: "academic_year.desc" }),
    fetchFirst<{ month: string }>("t_revenue_txn", "month", { order: "payment_date.desc" }),
    fetchAll<{ branch_id: number; branch_name: string }>("t_branch", "branch_id,branch_name", { branch_id: "not.in.(100)" }),
    fetchAll<{ agent_id: number; agent_name: string }>("t_agent", "agent_id,agent_name"),
    fetchAll<{ id: number; academic_year: string; branch_id: number; target_revenue: number | string; updated_at: string }>(
      "t_revenue_annual_target",
      "id,academic_year,branch_id,target_revenue,updated_at",
      { branch_id: "not.in.(100)" },
    ),
    fetchAll<{ id: number; academic_year: string; month: string; week_start: string; branch_id: number; target_revenue: number | string; updated_at: string }>(
      "t_branch_weekly_target",
      "id,academic_year,month,week_start,branch_id,target_revenue,updated_at",
      { branch_id: "not.in.(100)" },
    ),
    fetchAll<{ id: number; agent_id: number; academic_year: string; month: string; week_start: string; branch_id: number | null; target_revenue: number | string; updated_at: string }>(
      "t_agent_weekly_target",
      "id,agent_id,academic_year,month,week_start,branch_id,target_revenue,updated_at",
      { or: "(branch_id.is.null,branch_id.not.in.(100))" },
    ),
  ]);

  const activeAcademicYear = activeYearRow?.academic_year ?? null;
  const latestTransactionMonth = canonicalMonth(latestTransaction?.month);
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const records: SettingsTargetRecord[] = [];

  if (activeAcademicYear) {
    for (const row of annualRows.filter((item) => item.academic_year === activeAcademicYear)) {
      records.push({
        id: String(row.id), kind: "annual", academicYear: row.academic_year, month: "-", weekStart: null,
        branchId: row.branch_id, branchName: branchById.get(row.branch_id) ?? "Unknown branch", agentId: null, agentName: "-",
        targetRevenue: parseRevenue(row.target_revenue), updatedAt: row.updated_at,
      });
    }
  }

  const activeBranchWeeklyRows = branchWeeklyRows.filter((row) => row.academic_year === activeAcademicYear);
  for (const row of activeBranchWeeklyRows) {
    const month = canonicalMonth(row.month);
    if (!month) continue;
    records.push({
      id: String(row.id), kind: "branch_weekly", academicYear: row.academic_year, month, weekStart: row.week_start,
      branchId: row.branch_id, branchName: branchById.get(row.branch_id) ?? "Unknown branch", agentId: null, agentName: "-",
      targetRevenue: parseRevenue(row.target_revenue), updatedAt: row.updated_at,
    });
  }

  const monthlyByKey = new Map<string, SettingsTargetRecord>();
  for (const row of activeBranchWeeklyRows) {
    const month = canonicalMonth(row.month);
    if (!month) continue;
    const key = `${row.branch_id}|${month}`;
    const current = monthlyByKey.get(key);
    monthlyByKey.set(key, {
      id: `derived-${key}`, kind: "monthly", academicYear: row.academic_year, month, weekStart: null,
      branchId: row.branch_id, branchName: branchById.get(row.branch_id) ?? "Unknown branch", agentId: null, agentName: "-",
      targetRevenue: (current?.targetRevenue ?? 0) + parseRevenue(row.target_revenue),
      updatedAt: !current || row.updated_at > current.updatedAt ? row.updated_at : current.updatedAt,
    });
  }
  records.push(...monthlyByKey.values());

  for (const row of agentWeeklyRows.filter((item) => item.academic_year === activeAcademicYear)) {
    const month = canonicalMonth(row.month);
    if (!month) continue;
    records.push({
      id: String(row.id), kind: "agent_weekly", academicYear: row.academic_year, month, weekStart: row.week_start,
      branchId: row.branch_id, branchName: row.branch_id === null ? "Unassigned" : branchById.get(row.branch_id) ?? "Unknown branch",
      agentId: row.agent_id, agentName: agentById.get(row.agent_id) ?? "Unknown agent", targetRevenue: parseRevenue(row.target_revenue), updatedAt: row.updated_at,
    });
  }

  const candidateMonths = records.map((record) => record.month).filter((month) => month !== "-");
  const latestMonth = activeAcademicYear ? latestMonthForAcademicYear(activeAcademicYear, candidateMonths, latestTransactionMonth) : null;
  const latestKey = latestMonth ? monthKey(latestMonth) : Number.POSITIVE_INFINITY;
  const months = activeAcademicYear
    ? academicMonths
      .map((_, index) => monthLabelForAcademicYear(index, activeAcademicYear))
      .filter((month) => monthKey(month) <= latestKey)
    : [];

  return {
    activeAcademicYear,
    latestTransactionMonth: latestMonth,
    months,
    branches: branches
      .map((row) => ({ id: row.branch_id, name: row.branch_name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    records: records.sort((left, right) => (right.weekStart ?? right.updatedAt).localeCompare(left.weekStart ?? left.updatedAt)),
  };
}
