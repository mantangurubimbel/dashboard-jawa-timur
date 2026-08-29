import { cache } from "react";
import { supabaseRpcFetch, supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";
import {
  DashboardBranchScope,
  getDashboardBranchScope,
  resolveScopedBranchId,
} from "@/lib/dashboard-access";
import {
  DashboardData,
  DashboardFilters,
  BranchFilterOption,
  FilterOption,
  AgentPerformance,
  MonthlyComparisonPoint,
  SummaryPoint,
  TransactionRow,
} from "@/lib/types";

type RevenueTxnRecord = {
  id: number;
  payment_date: string;
  month: string;
  invoice: string;
  grade_id: number | null;
  product_id: number | null;
  agent_id: number | null;
  branch_destination_id: number | null;
  branch_id: number | null;
  is_newtxn: boolean;
  is_fullpayment: boolean;
  academic_year: string | null;
  npsn: string | null;
  revenue: number | string | null;
  is_bulkbuying: boolean;
};

type GradeLookup = {
  grade_id: number;
  grade: string;
};

type ProductLookup = {
  product_id: number;
  product_code: string;
};

type AgentLookup = {
  agent_id: number;
  agent_name: string;
};

type BranchLookup = {
  branch_id: number;
  branch_name: string;
  region_id: number | null;
};

type RegionLookup = {
  region_id: number;
  region_name: string;
};

type RevenueAnnualTargetLookup = {
  academic_year: string;
  branch_id: number;
  target_revenue: number | string | null;
};

type RevenueMonthlyTargetLookup = RevenueAnnualTargetLookup & {
  month_number: number;
};

const scopedSnapshotFetchInit: SupabaseFetchInit = {
  next: { revalidate: 30, tags: ["revenue-dashboard"] },
};

let latestPeriodRpcUnavailable = false;
let branchSummaryRpcUnavailable = false;

async function fetchAll<T>(
  table: string,
  select: string,
  pageSize = 1000,
  init: SupabaseFetchInit = {},
  query: Record<string, string> = {},
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const params = new URLSearchParams({
      select,
      limit: String(pageSize),
      offset: String(from),
      ...query,
    });
    const response = await supabaseRestFetch(`${table}?${params.toString()}`, init);
    if (!response.ok) {
      throw new Error(`${table}: ${await response.text()}`);
    }

    const data = (await response.json()) as T[];
    rows.push(...data);
    if (data.length < pageSize) {
      return rows;
    }
  }
}

async function fetchTransactions(
  filters: DashboardFilters,
  branchIds: number[] | null,
  options: { useStoredAcademicYear?: boolean; init?: SupabaseFetchInit } = {},
) {
  const rows: RevenueTxnRecord[] = [];
  const pageSize = 1000;
  const select =
    "id,payment_date,month,invoice,grade_id,product_id,agent_id,branch_destination_id,branch_id,is_newtxn,is_fullpayment,academic_year,npsn,revenue,is_bulkbuying";

  for (let from = 0; ; from += pageSize) {
    const params = new URLSearchParams({
      select,
      order: "payment_date.desc",
      limit: String(pageSize),
      offset: String(from),
    });
    if (options.useStoredAcademicYear !== false && filters.academicYear) {
      params.set("academic_year", `eq.${filters.academicYear}`);
    }
    if (filters.branchId !== undefined) {
      if (branchIds && !branchIds.includes(filters.branchId)) return [];
      params.set("branch_id", `eq.${filters.branchId}`);
    }
    if (filters.month) params.set("month", `ilike.${filters.month} %`);
    if (filters.fromDate) params.append("payment_date", `gte.${filters.fromDate}`);
    if (filters.toDate) params.append("payment_date", `lte.${filters.toDate}`);
    if (branchIds && filters.branchId === undefined) {
      if (!branchIds.length) return [];
      params.set("branch_id", `in.(${branchIds.join(",")})`);
    }

    const response = await supabaseRestFetch(`t_revenue_txn?${params.toString()}`, options.init);
    if (!response.ok) throw new Error(`t_revenue_txn: ${await response.text()}`);

    const data = (await response.json()) as RevenueTxnRecord[];
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

function scopedTransactionCacheKey(branchIds: number[] | null) {
  if (branchIds === null) return "*";
  return Array.from(new Set(branchIds)).sort((a, b) => a - b).join(",");
}

/**
 * Several executive-summary sections need the same unfiltered transaction
 * snapshot for a branch scope. Keep this request-scoped so the local
 * non-admin path does not scan the same Supabase pages repeatedly.
 */
const fetchScopedTransactionSnapshot = cache(async (branchIdsKey: string) => {
  const branchIds = branchIdsKey === "*"
    ? null
    : branchIdsKey
      ? branchIdsKey.split(",").map(Number)
      : [];

  return fetchTransactions({}, branchIds, {
    useStoredAcademicYear: false,
    init: scopedSnapshotFetchInit,
  });
});

function parseRevenue(value: number | string | null) {
  return Number(value ?? 0) || 0;
}

function toTransactionRow(row: RevenueTxnRecord): TransactionRow {
  return {
    id: row.id,
    paymentDate: row.payment_date,
    month: row.month,
    invoice: row.invoice,
    gradeId: row.grade_id,
    productId: row.product_id,
    agentId: row.agent_id,
    branchDestinationId: row.branch_destination_id,
    branchId: row.branch_id,
    isNewTxn: row.is_newtxn,
    isFullPayment: row.is_fullpayment,
    academicYear: row.academic_year ?? "",
    npsn: row.npsn,
    revenue: parseRevenue(row.revenue),
    isBulkBuying: row.is_bulkbuying,
  };
}

function labelForId(
  id: number | null,
  labels: Map<number, string>,
  prefix: string,
) {
  return id === null ? "(empty)" : labels.get(id) ?? `${prefix} #${id}`;
}

function summarize(
  rows: TransactionRow[],
  key: (row: TransactionRow) => string,
  limit?: number,
) {
  const grouped = new Map<string, SummaryPoint>();

  for (const row of rows) {
    const name = key(row) || "(empty)";
    const current = grouped.get(name) ?? { name, revenue: 0, transactions: 0 };
    current.revenue += row.revenue;
    current.transactions += 1;
    grouped.set(name, current);
  }

  const sorted = Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

function summarizeRevenueSource(
  rows: TransactionRow[],
  key: (row: TransactionRow) => string,
) {
  const grouped = new Map<string, {
    name: string;
    revenue: number;
    transactions: number;
    nonBulkRevenue: number;
    bulkRevenue: number;
    nonBulkTransactions: number;
    bulkTransactions: number;
  }>();

  for (const row of rows) {
    const name = key(row) || "(empty)";
    const current = grouped.get(name) ?? {
      name,
      revenue: 0,
      transactions: 0,
      nonBulkRevenue: 0,
      bulkRevenue: 0,
      nonBulkTransactions: 0,
      bulkTransactions: 0,
    };
    current.revenue += row.revenue;
    current.transactions += 1;
    if (row.isBulkBuying) current.bulkRevenue += row.revenue;
    else current.nonBulkRevenue += row.revenue;
    if (row.isNewTxn && row.isBulkBuying) current.bulkTransactions += 1;
    if (row.isNewTxn && !row.isBulkBuying) current.nonBulkTransactions += 1;
    grouped.set(name, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
}

function summarizeBranchRevenuePerformance(
  rows: TransactionRow[],
  branches: BranchLookup[],
  targetRevenue: number | Map<number, number>,
) {
  const grouped = new Map<number, number>();
  for (const row of rows) {
    if (row.branchId !== null) {
      grouped.set(row.branchId, (grouped.get(row.branchId) ?? 0) + row.revenue);
    }
  }
  return branches
    .filter((branch) => grouped.has(branch.branch_id))
    .map((branch) => ({
      name: branch.branch_name,
      revenue: grouped.get(branch.branch_id) ?? 0,
      target: targetRevenue instanceof Map
        ? targetRevenue.get(branch.branch_id) ?? 0
        : targetRevenue,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function monthSortValue(month: string) {
  const match = month.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const monthIndex = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].indexOf(match[1]);

  return Number(match[2]) * 12 + monthIndex;
}

function monthLabel(month: string) {
  return month.match(/^([A-Za-z]+)/)?.[1] ?? month;
}

function academicYearFromMonth(month: string) {
  const match = month.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const calendarYear = Number(match[2]);
  const startYear = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].includes(match[1])
    ? calendarYear
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].includes(match[1])
      ? calendarYear - 1
      : null;

  return startYear === null
    ? null
    : `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

const academicYearMonthOrder = [
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
];

function previousAcademicYear(academicYear: string | undefined, years: string[]) {
  if (!academicYear) return null;

  const match = academicYear.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;

  const previous = `${String((Number(match[1]) + 99) % 100).padStart(2, "0")}/${match[1]}`;
  return years.includes(previous) ? previous : null;
}

function previousAcademicYearFrom(academicYear: string) {
  const match = academicYear.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;
  return `${String((Number(match[1]) + 99) % 100).padStart(2, "0")}/${match[1]}`;
}

function previousYearDate(date: string | undefined) {
  if (!date) return undefined;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const previousYear = year - 1;
  const lastDayOfMonth = new Date(Date.UTC(previousYear, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return `${previousYear}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function academicMonthNumber(month: string) {
  const index = academicYearMonthOrder.indexOf(month);
  return index === -1 ? null : index + 1;
}

function filterDashboardBranchOptions(
  dashboard: DashboardData,
  scope: DashboardBranchScope,
) {
  if (scope === null) return dashboard;

  const allowed = new Set(scope);
  const branches = dashboard.filters.branches.filter((branch) => allowed.has(Number(branch.id)));
  const regionIds = new Set(branches.map((branch) => branch.regionId));

  return {
    ...dashboard,
    filters: {
      ...dashboard.filters,
      branches,
      regions: dashboard.filters.regions.filter((region) => regionIds.has(region.id)),
    },
  };
}

type RevenueGrowthComparison = {
  currentRevenue: number;
  previousRevenue: number;
  lastTwoYearsRevenue: number;
  growthVsLy: number | null;
  growthVsL2y: number | null;
  cutoffDate: string | null;
  lyCutoffDate: string | null;
  l2yCutoffDate: string | null;
};

function revenueGrowthRatio(currentRevenue: number, previousRevenue: number) {
  return previousRevenue === 0 ? null : currentRevenue / previousRevenue;
}

function normalizeRevenueGrowthPayload(payload: unknown): RevenueGrowthComparison {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const numberValue = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const currentRevenue = numberValue(raw.currentRevenue);
  const previousRevenue = numberValue(raw.previousRevenue);
  const lastTwoYearsRevenue = numberValue(raw.lastTwoYearsRevenue);
  const ratioValue = (value: unknown, fallback: number | null) => {
    if (value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    currentRevenue,
    previousRevenue,
    lastTwoYearsRevenue,
    growthVsLy: ratioValue(raw.growthVsLy, revenueGrowthRatio(currentRevenue, previousRevenue)),
    growthVsL2y: ratioValue(raw.growthVsL2y, revenueGrowthRatio(currentRevenue, lastTwoYearsRevenue)),
    cutoffDate: typeof raw.cutoffDate === "string" ? raw.cutoffDate : null,
    lyCutoffDate: typeof raw.lyCutoffDate === "string" ? raw.lyCutoffDate : null,
    l2yCutoffDate: typeof raw.l2yCutoffDate === "string" ? raw.l2yCutoffDate : null,
  };
}

function calculateRevenueGrowthFromRows(
  rows: TransactionRow[],
  filters: DashboardFilters,
): RevenueGrowthComparison {
  const currentAcademicYear = filters.academicYear;
  if (!currentAcademicYear) {
    return {
      currentRevenue: 0,
      previousRevenue: 0,
      lastTwoYearsRevenue: 0,
      growthVsLy: null,
      growthVsL2y: null,
      cutoffDate: null,
      lyCutoffDate: null,
      l2yCutoffDate: null,
    };
  }

  const previousAcademicYear = previousAcademicYearFrom(currentAcademicYear);
  const lastTwoAcademicYear = previousAcademicYear
    ? previousAcademicYearFrom(previousAcademicYear)
    : null;
  const matchesMonth = (row: TransactionRow) =>
    !filters.month || monthLabel(row.month) === filters.month;
  const currentRows = rows.filter((row) =>
    academicYearFromMonth(row.month) === currentAcademicYear &&
    matchesMonth(row) &&
    (!filters.fromDate || row.paymentDate >= filters.fromDate) &&
    (!filters.toDate || row.paymentDate <= filters.toDate),
  );
  const cutoffDate = currentRows.reduce<string | null>(
    (latest, row) => latest === null || row.paymentDate > latest ? row.paymentDate : latest,
    null,
  );

  if (!cutoffDate) {
    return {
      currentRevenue: 0,
      previousRevenue: 0,
      lastTwoYearsRevenue: 0,
      growthVsLy: null,
      growthVsL2y: null,
      cutoffDate: null,
      lyCutoffDate: null,
      l2yCutoffDate: null,
    };
  }

  const lyCutoffDate = previousYearDate(cutoffDate) ?? null;
  const l2yCutoffDate = previousYearDate(lyCutoffDate ?? undefined) ?? null;
  const lyStartDate = previousYearDate(filters.fromDate) ?? null;
  const l2yStartDate = previousYearDate(lyStartDate ?? undefined) ?? null;
  const sumRevenue = (candidateRows: TransactionRow[]) =>
    candidateRows.reduce((sum, row) => sum + row.revenue, 0);
  const previousRows = rows.filter((row) =>
    previousAcademicYear !== null &&
    academicYearFromMonth(row.month) === previousAcademicYear &&
    matchesMonth(row) &&
    !!lyCutoffDate &&
    row.paymentDate <= lyCutoffDate &&
    (!lyStartDate || row.paymentDate >= lyStartDate),
  );
  const lastTwoRows = rows.filter((row) =>
    lastTwoAcademicYear !== null &&
    academicYearFromMonth(row.month) === lastTwoAcademicYear &&
    matchesMonth(row) &&
    !!l2yCutoffDate &&
    row.paymentDate <= l2yCutoffDate &&
    (!l2yStartDate || row.paymentDate >= l2yStartDate),
  );
  const currentRevenue = sumRevenue(currentRows);
  const previousRevenue = sumRevenue(previousRows);
  const lastTwoYearsRevenue = sumRevenue(lastTwoRows);

  return {
    currentRevenue,
    previousRevenue,
    lastTwoYearsRevenue,
    growthVsLy: revenueGrowthRatio(currentRevenue, previousRevenue),
    growthVsL2y: revenueGrowthRatio(currentRevenue, lastTwoYearsRevenue),
    cutoffDate,
    lyCutoffDate,
    l2yCutoffDate,
  };
}

async function getRevenueGrowthSameDateLegacy(
  filters: DashboardFilters,
  branchScope: DashboardBranchScope,
): Promise<RevenueGrowthComparison> {
  if (branchScope !== null && !branchScope.length) {
    return calculateRevenueGrowthFromRows([], filters);
  }

  const branchQuery: Record<string, string> = branchScope === null
    ? {}
    : { branch_id: `in.(${branchScope.join(",")})` };
  const branches = await fetchAll<BranchLookup>(
    "t_branch",
    "branch_id,branch_name,region_id",
    1000,
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    branchQuery,
  );
  const availableBranchIds = branches.map((branch) => branch.branch_id);
  const regionBranchIds = filters.regionId === undefined
    ? branchScope === null ? null : availableBranchIds
    : branches
        .filter((branch) => branch.region_id === filters.regionId)
        .map((branch) => branch.branch_id);
  const selectedBranchId = resolveScopedBranchId(branchScope, filters.branchId);
  const rows = await fetchTransactions(
    { branchId: selectedBranchId },
    regionBranchIds,
    {
      useStoredAcademicYear: false,
      init: { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    },
  );

  return calculateRevenueGrowthFromRows(rows.map(toTransactionRow), filters);
}

/**
 * Return KPI growth ratios using the latest current-year payment date as the
 * cutoff, then shift that date by one and two calendar years for LY/L2Y.
 * The full-year comparison series from get_revenue_dashboard_v2 is kept
 * untouched because it is also used by the cumulative revenue chart.
 */
export async function getRevenueGrowthSameDate(
  filters: DashboardFilters = {},
  branchScope?: DashboardBranchScope,
): Promise<RevenueGrowthComparison> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const academicYearOptions = await getRevenueAcademicYearOptions();
  const selectedAcademicYear =
    filters.academicYear && academicYearOptions.some((option) => option.id === filters.academicYear)
      ? filters.academicYear
      : academicYearOptions[0]?.id;
  const selectedFilters = {
    ...filters,
    academicYear: selectedAcademicYear,
    branchId: resolveScopedBranchId(scope, filters.branchId),
  };

  // The RPC is available only to the unrestricted/admin path. A scoped user
  // must calculate locally so no other branch's revenue can be exposed.
  if (scope !== null) {
    return getRevenueGrowthSameDateLegacy(selectedFilters, scope);
  }

  const response = await supabaseRpcFetch(
    "get_revenue_growth_same_date",
    {
      p_academic_year: selectedFilters.academicYear ?? null,
      p_region_id: selectedFilters.regionId ?? null,
      p_branch_id: selectedFilters.branchId ?? null,
      p_month: selectedFilters.month ?? null,
      p_from_date: selectedFilters.fromDate ?? null,
      p_to_date: selectedFilters.toDate ?? null,
    },
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );

  if (response.ok) {
    return normalizeRevenueGrowthPayload(await response.json());
  }

  const errorText = await response.text();
  if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
    throw new Error(`Revenue growth RPC failed: ${errorText}`);
  }

  // Keep local development usable while the migration has not yet been
  // applied. Once deployed, the RPC path avoids another full-table scan.
  return getRevenueGrowthSameDateLegacy(selectedFilters, scope);
}

export async function getDashboardData(
  filters: DashboardFilters = {},
  branchScope?: DashboardBranchScope,
): Promise<DashboardData> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const academicYearOptions = await getRevenueAcademicYearOptions();
  const selectedAcademicYear =
    filters.academicYear && academicYearOptions.some((option) => option.id === filters.academicYear)
      ? filters.academicYear
      : academicYearOptions[0]?.id;
  const selectedFilters = {
    ...filters,
    academicYear: selectedAcademicYear,
    branchId: resolveScopedBranchId(scope, filters.branchId),
  };

  // The dashboard RPC is intentionally kept as the fast path for admins. A
  // non-admin uses the legacy server-side aggregation with an explicit branch
  // scope because the existing RPC is security-definer/service-role backed.
  if (scope !== null) {
    return getDashboardDataLegacy(selectedFilters, scope);
  }

  const response = await supabaseRpcFetch(
    "get_revenue_dashboard_v2",
    {
      p_academic_year: selectedFilters.academicYear ?? null,
      p_region_id: selectedFilters.regionId ?? null,
      p_branch_id: selectedFilters.branchId ?? null,
      // Academic periods are defined by t_revenue_txn.month, not payment_date.
      p_month: selectedFilters.month ?? null,
      p_from_date: selectedFilters.fromDate ?? null,
      p_to_date: selectedFilters.toDate ?? null,
    },
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );

  if (response.ok) {
    const payload = await response.json();
    const dashboard = filterDashboardBranchOptions(normalizeDashboardPayload(payload), scope);
    dashboard.filters.academicYears = academicYearOptions;
    return dashboard;
  }

  const errorText = await response.text();
  if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
    throw new Error(`Dashboard RPC failed: ${errorText}`);
  }

  return getDashboardDataLegacy(selectedFilters, scope);
}

export async function getLatestRevenuePaymentDate(branchScope?: DashboardBranchScope) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return { latestDate: null, startDate: null };
  if (!latestPeriodRpcUnavailable) {
    const periodResponse = await supabaseRpcFetch(
      "get_latest_revenue_period",
      { p_branch_ids: scope },
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    );
    if (periodResponse.ok) {
      const payload = await periodResponse.json() as {
        latestDate?: string | null;
        startDate?: string | null;
      };
      if (
        Object.prototype.hasOwnProperty.call(payload, "latestDate") &&
        Object.prototype.hasOwnProperty.call(payload, "startDate")
      ) {
        return {
          latestDate: payload.latestDate ?? null,
          startDate: payload.startDate ?? null,
        };
      }
    } else {
      const errorText = await periodResponse.text();
      if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
        throw new Error(`Latest revenue period RPC failed: ${errorText}`);
      }
      latestPeriodRpcUnavailable = true;
    }
  }
  // Keep local development usable while the migration has not yet been
  // applied. Fall back to the two existing REST reads below.

  const params = new URLSearchParams({
    select: "payment_date,month,academic_year,branch_id",
    order: "payment_date.desc",
    limit: "1",
  });
  if (scope !== null) {
    params.set("branch_id", `in.(${scope.join(",")})`);
  }
  const response = await supabaseRestFetch(
    `t_revenue_txn?${params.toString()}`,
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );
  if (!response.ok) throw new Error(`Latest revenue date request failed: ${await response.text()}`);
  const rows = (await response.json()) as Array<{ payment_date?: string; month?: string; academic_year?: string }>;
  const latest = rows[0];
  if (!latest?.payment_date || !latest.academic_year) return { latestDate: latest?.payment_date ?? null, startDate: null };
  const startParams = new URLSearchParams({
    select: "payment_date",
    academic_year: `eq.${latest.academic_year}`,
    month: "ilike.Jul %",
    order: "payment_date.asc",
    limit: "1",
  });
  if (scope !== null) startParams.set("branch_id", `in.(${scope.join(",")})`);
  const startResponse = await supabaseRestFetch(
    `t_revenue_txn?${startParams.toString()}`,
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );
  if (!startResponse.ok) throw new Error(`Revenue start date request failed: ${await startResponse.text()}`);
  const starts = (await startResponse.json()) as Array<{ payment_date?: string }>;
  return { latestDate: latest.payment_date, startDate: starts[0]?.payment_date ?? null };
}

export async function getBulkBuyingGrowth(
  academicYear: string,
  fromDate: string,
  toDate: string,
  branchScope?: DashboardBranchScope,
) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return { currentRevenue: 0, previousRevenue: 0 };
  if (scope !== null) {
    const rows = await fetchScopedTransactionSnapshot(scopedTransactionCacheKey(scope));
    const previousAcademicYear = previousAcademicYearFrom(academicYear);
    const previousFromDate = previousYearDate(fromDate);
    const previousToDate = previousYearDate(toDate);
    return {
      currentRevenue: rows
        .filter((row) => row.is_bulkbuying && academicYearFromMonth(row.month) === academicYear && row.payment_date >= fromDate && row.payment_date <= toDate)
        .reduce((sum, row) => sum + parseRevenue(row.revenue), 0),
      previousRevenue: rows
        .filter((row) => row.is_bulkbuying && previousAcademicYear !== null && academicYearFromMonth(row.month) === previousAcademicYear && (!previousFromDate || row.payment_date >= previousFromDate) && (!previousToDate || row.payment_date <= previousToDate))
        .reduce((sum, row) => sum + parseRevenue(row.revenue), 0),
    };
  }
  const response = await supabaseRpcFetch("get_bulk_buying_growth", {
    p_academic_year: academicYear, p_from_date: fromDate, p_to_date: toDate,
  }, { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  if (!response.ok) throw new Error(`Bulk buying RPC failed: ${await response.text()}`);
  const value = await response.json() as { currentRevenue?: number; previousRevenue?: number };
  return { currentRevenue: Number(value.currentRevenue ?? 0), previousRevenue: Number(value.previousRevenue ?? 0) };
}

export async function getBranchRevenuePerformance(
  academicYear: string,
  regionId?: number,
  branchId?: number,
  month?: string,
  branchScope?: DashboardBranchScope,
) {
  const scope = branchScope ?? await getDashboardBranchScope();
  const selectedBranchId = resolveScopedBranchId(scope, branchId);
  if (scope !== null) {
    if (!scope.length) return [];
    const branchQuery: Record<string, string> = scope.length ? { branch_id: `in.(${scope.join(",")})` } : {};
    const [branches, rows, annualTargets, monthlyTargets] = await Promise.all([
      fetchAll<BranchLookup>("t_branch", "branch_id,branch_name,region_id", 1000, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }, branchQuery),
      fetchTransactions({ academicYear }, scope, { useStoredAcademicYear: false, init: { next: { revalidate: 30, tags: ["revenue-dashboard"] } } }),
      fetchAll<RevenueAnnualTargetLookup>("t_revenue_annual_target", "academic_year,branch_id,target_revenue", 1000, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }, branchQuery),
      fetchAll<RevenueMonthlyTargetLookup>("t_revenue_monthly_target", "academic_year,branch_id,month_number,target_revenue", 1000, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }, branchQuery),
    ]);
    const selectedRows = rows
      .map(toTransactionRow)
      .filter((row) => academicYearFromMonth(row.month) === academicYear)
      .filter((row) => !month || monthLabel(row.month) === month);
    const selectedBranches = branches.filter((branch) =>
      (regionId === undefined || branch.region_id === regionId) &&
      (selectedBranchId === undefined || branch.branch_id === selectedBranchId),
    );
    const revenueByBranch = new Map<number, number>();
    for (const row of selectedRows) {
      if (row.branchId !== null) revenueByBranch.set(row.branchId, (revenueByBranch.get(row.branchId) ?? 0) + row.revenue);
    }
    const targetByBranch = new Map<number, number>();
    for (const target of (month ? monthlyTargets.filter((item) => item.month_number === academicMonthNumber(month)) : annualTargets)) {
      if (target.academic_year !== academicYear) continue;
      targetByBranch.set(target.branch_id, (targetByBranch.get(target.branch_id) ?? 0) + parseRevenue(target.target_revenue));
    }
    return selectedBranches
      .filter((branch) => revenueByBranch.has(branch.branch_id))
      .map((branch) => ({ name: branch.branch_name, revenue: revenueByBranch.get(branch.branch_id) ?? 0, target: targetByBranch.get(branch.branch_id) ?? 0 }))
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  }
  const response = await supabaseRpcFetch("get_branch_revenue_performance", {
    p_academic_year: academicYear,
    p_region_id: regionId ?? null,
    p_branch_id: branchId ?? null,
    p_month: month ?? null,
  }, { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  if (!response.ok) throw new Error(`Branch performance RPC failed: ${await response.text()}`);
  return (await response.json()) as DashboardData["branchRevenuePerformance"];
}

export async function getBranchRevenueSummary(
  academicYear: string,
  branchScope?: DashboardBranchScope,
) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return [];
  if (scope === null) {
    if (!branchSummaryRpcUnavailable) {
      const response = await supabaseRpcFetch(
        "get_executive_branch_revenue_summary",
        { p_academic_year: academicYear },
        { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
      );
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload)) {
          return payload.map((row) => {
            const value = row as Record<string, unknown>;
            return {
              name: String(value.name ?? "(empty)"),
              newTransactions: Number(value.newTransactions ?? value.new_transactions ?? 0),
              revenue: Number(value.revenue ?? 0),
            };
          });
        }
      } else {
        const errorText = await response.text();
        if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
          throw new Error(`Executive branch summary RPC failed: ${errorText}`);
        }
        branchSummaryRpcUnavailable = true;
      }
    }
    // Keep local development usable while the migration has not yet been
    // applied. The scoped/local path below preserves the existing result.
  }

  return getBranchRevenueSummaryLegacy(academicYear, scope);
}

async function getBranchRevenueSummaryLegacy(
  academicYear: string,
  scope: DashboardBranchScope,
) {
  const [branches, rows] = await Promise.all([
    fetchAll<BranchLookup>("t_branch", "branch_id,branch_name,region_id", 1000, {
      next: { revalidate: 30, tags: ["revenue-dashboard"] },
    }, scope === null ? {} : { branch_id: `in.(${scope.join(",")})` } as Record<string, string>),
    fetchScopedTransactionSnapshot(scopedTransactionCacheKey(scope ?? null)),
  ]);
  const branchMap = new Map(
    branches.map((branch) => [branch.branch_id, branch.branch_name]),
  );
  const grouped = new Map<number, {
    name: string;
    newTransactions: number;
    revenue: number;
  }>();

  for (const row of rows) {
    if (row.branch_id === null || academicYearFromMonth(row.month) !== academicYear) {
      continue;
    }
    const current = grouped.get(row.branch_id) ?? {
      name: branchMap.get(row.branch_id) ?? "Branch not found",
      newTransactions: 0,
      revenue: 0,
    };
    current.revenue += parseRevenue(row.revenue);
    if (row.is_newtxn) current.newTransactions += 1;
    grouped.set(row.branch_id, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function normalizeDashboardPayload(payload: Record<string, unknown>): DashboardData {
  const rawKpis = (payload.kpis ?? {}) as Record<string, unknown>;
  const rawComparison = (payload.monthlyRevenueComparison ?? {}) as {
    currentAcademicYear?: string | null;
    previousAcademicYear?: string | null;
    rows?: Record<string, unknown>[];
  };
  const comparisonRows = (rawComparison.rows ?? []).map((row) => ({
    month: String(row.month ?? ""),
    currentRevenue: Number(row.currentRevenue ?? 0),
    currentCumulativeRevenue: Number(row.currentCumulativeRevenue ?? 0),
    currentTransactions: Number(row.currentTransactions ?? 0),
    previousRevenue:
      row.previousRevenue === null || row.previousRevenue === undefined
        ? null
        : Number(row.previousRevenue),
    previousCumulativeRevenue:
      row.previousCumulativeRevenue === null || row.previousCumulativeRevenue === undefined
        ? null
        : Number(row.previousCumulativeRevenue),
    previousTransactions:
      row.previousTransactions === null || row.previousTransactions === undefined
        ? null
        : Number(row.previousTransactions),
    lastTwoYearsRevenue:
      row.lastTwoYearsRevenue === null || row.lastTwoYearsRevenue === undefined
        ? null
        : Number(row.lastTwoYearsRevenue),
    lastTwoYearsCumulativeRevenue:
      row.lastTwoYearsCumulativeRevenue === null ||
      row.lastTwoYearsCumulativeRevenue === undefined
        ? null
        : Number(row.lastTwoYearsCumulativeRevenue),
    targetRevenue:
      row.targetRevenue === null || row.targetRevenue === undefined
        ? null
        : Number(row.targetRevenue),
    targetCumulativeRevenue:
      row.targetCumulativeRevenue === null || row.targetCumulativeRevenue === undefined
        ? null
        : Number(row.targetCumulativeRevenue),
  }));
  const lastComparisonRow = comparisonRows.at(-1);
  const currentRevenue = lastComparisonRow?.currentCumulativeRevenue ?? 0;
  const lyRevenue = lastComparisonRow?.previousCumulativeRevenue ?? 0;
  const l2yRevenue = lastComparisonRow?.lastTwoYearsCumulativeRevenue ?? 0;
  const kpis = {
    ...rawKpis,
    targetAnnualRevenue: Number(rawKpis.targetAnnualRevenue ?? 0),
    achievement:
      rawKpis.achievement === null || rawKpis.achievement === undefined
        ? null
        : Number(rawKpis.achievement),
    varianceToTarget: Number(rawKpis.varianceToTarget ?? 0),
    growthVsLy:
      rawKpis.growthVsLy === null || rawKpis.growthVsLy === undefined
        ? lyRevenue > 0
          ? currentRevenue / lyRevenue
          : null
        : Number(rawKpis.growthVsLy),
    growthVsL2y:
      rawKpis.growthVsL2y === null || rawKpis.growthVsL2y === undefined
        ? l2yRevenue > 0
          ? currentRevenue / l2yRevenue
          : null
        : Number(rawKpis.growthVsL2y),
  } as DashboardData["kpis"];
  const rawFilters = (payload.filters ?? {}) as {
    academicYears?: DashboardData["filters"]["academicYears"];
    regions?: DashboardData["filters"]["regions"];
    branches?: Array<{ id: string; label: string; regionId?: string | number | null }>;
    months?: DashboardData["filters"]["months"];
  };
  const filters: DashboardData["filters"] = {
    academicYears: rawFilters.academicYears ?? [],
    regions: rawFilters.regions ?? [],
    branches: (rawFilters.branches ?? []).map((branch) => ({
      id: branch.id,
      label: branch.label,
      regionId: String(branch.regionId ?? ""),
    })),
    months: rawFilters.months ?? academicYearMonthOrder.map((month) => ({
      id: month,
      label: month,
    })),
  };
  const recentTransactions = (
    (payload.recentTransactions ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    id: Number(row.id),
    paymentDate: String(row.paymentDate ?? row.payment_date ?? ""),
    invoice: String(row.invoice ?? ""),
    product: String(row.product ?? "(empty)"),
    branch: String(row.branch ?? "(empty)"),
    revenue: Number(row.revenue ?? 0),
    flags: Array.isArray(row.flags) ? row.flags.map(String) : [],
  }));
  const agentPerformance = (
    (payload.agentPerformance ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    agent: String(row.agent ?? "(Unmapped agent)"),
    branch: String(row.branch ?? "(empty)"),
    schools: Number(row.schools ?? 0),
    revenueNonBulkBuying: Number(row.revenue_non_bulk_buying ?? 0),
    revenueNewTxnNonBulkBuying: Number(row.revenue_new_txn_non_bulk_buying ?? 0),
    newTxnNonBulkBuying: Number(row.new_txn_non_bulk_buying ?? 0),
    transactionsNonBulkBuying: Number(row.transactions_non_bulk_buying ?? 0),
  }));
  return {
    filters,
    kpis,
    monthlyRevenue: ((payload.monthlyRevenue ?? []) as DashboardData["monthlyRevenue"]).map((row) => ({
      ...row,
      revenue: Number(row.revenue ?? 0),
      transactions: Number(row.transactions ?? 0),
    })),
    monthlyRevenueComparison: {
      currentAcademicYear: rawComparison.currentAcademicYear ?? null,
      previousAcademicYear: rawComparison.previousAcademicYear ?? null,
      rows: comparisonRows,
    },
    regionalRevenue: (payload.regionalRevenue ?? []) as DashboardData["regionalRevenue"],
    regionalRevenueSource: (payload.regionalRevenueSource ??
      []) as DashboardData["regionalRevenueSource"],
    branchRevenue: (payload.branchRevenue ?? []) as DashboardData["branchRevenue"],
    branchRevenuePerformance: ((payload.branchRevenuePerformance ?? []) as DashboardData["branchRevenuePerformance"])
      .sort((a, b) => a.name.localeCompare(b.name)),
    productRevenue: (payload.productRevenue ?? []) as DashboardData["productRevenue"],
    productRevenueRetail: (payload.productRevenueRetail ??
      []) as DashboardData["productRevenueRetail"],
    paymentCategoryRevenue: (payload.paymentCategoryRevenue ??
      []) as DashboardData["paymentCategoryRevenue"],
    levelRevenue: (payload.levelRevenue ?? []) as DashboardData["levelRevenue"],
    dataQuality: (payload.dataQuality ?? []) as DashboardData["dataQuality"],
    recentTransactions,
    agentPerformance,
  };
}

async function getDashboardDataLegacy(
  filters: DashboardFilters = {},
  branchScope: DashboardBranchScope = null,
): Promise<DashboardData> {
  const [grades, products, agents, branches, regions, academicYears, annualTargets, monthlyTargets] = await Promise.all([
    fetchAll<GradeLookup>("t_grade", "grade_id,grade"),
    fetchAll<ProductLookup>("t_revenue_products", "product_id,product_code"),
    fetchAll<AgentLookup>("t_agent", "agent_id,agent_name"),
    fetchAll<BranchLookup>("t_branch", "branch_id,branch_name,region_id"),
    fetchAll<RegionLookup>("t_region", "region_id,region_name"),
    fetchAll<{ academic_year: string }>("t_academic_year", "academic_year"),
    fetchAll<RevenueAnnualTargetLookup>("t_revenue_annual_target", "academic_year,branch_id,target_revenue"),
    fetchAll<RevenueMonthlyTargetLookup>("t_revenue_monthly_target", "academic_year,branch_id,month_number,target_revenue"),
  ]);

  const availableBranches = branchScope === null
    ? branches
    : branches.filter((branch) => branchScope.includes(branch.branch_id));
  const availableBranchIds = availableBranches.map((branch) => branch.branch_id);

  const regionBranchIds =
    filters.regionId === undefined
      ? availableBranches.length === branches.length && branchScope === null ? null : availableBranchIds
      : branches
          .filter((branch) => branch.region_id === filters.regionId && availableBranchIds.includes(branch.branch_id))
          .map((branch) => branch.branch_id);
  const allAcademicYears = academicYears.map((row) => row.academic_year);
  const previousYear = previousAcademicYear(filters.academicYear, allAcademicYears);
  const lastTwoYear = previousAcademicYear(previousYear ?? undefined, allAcademicYears);
  const canUseUnfilteredSnapshot = !filters.regionId &&
    !filters.branchId &&
    !filters.month &&
    !filters.fromDate &&
    !filters.toDate;
  const unfilteredSnapshot = canUseUnfilteredSnapshot
    ? fetchScopedTransactionSnapshot(scopedTransactionCacheKey(regionBranchIds))
    : null;
  const transactionRowsPromise = unfilteredSnapshot ?? fetchTransactions(filters, regionBranchIds, {
    useStoredAcademicYear: false,
  });
  const comparisonRowsPromise = filters.academicYear
    ? unfilteredSnapshot ?? fetchTransactions(
        {
          ...filters,
          academicYear: previousYear ?? "__no_previous_year__",
          fromDate: previousYearDate(filters.fromDate),
          toDate: previousYearDate(filters.toDate),
        },
        regionBranchIds,
        { useStoredAcademicYear: false },
      )
    : filters.fromDate || filters.toDate
      ? fetchTransactions(
          {
            ...filters,
            academicYear: undefined,
            fromDate: previousYearDate(filters.fromDate),
            toDate: previousYearDate(filters.toDate),
          },
          regionBranchIds,
          { useStoredAcademicYear: false },
        )
      : Promise.resolve([]);
  const lastTwoRowsPromise = filters.academicYear && lastTwoYear
    ? unfilteredSnapshot ?? fetchTransactions(
        {
          ...filters,
          academicYear: lastTwoYear,
          fromDate: filters.fromDate ? previousYearDate(previousYearDate(filters.fromDate)) : undefined,
          toDate: filters.toDate ? previousYearDate(previousYearDate(filters.toDate)) : undefined,
        },
        regionBranchIds,
        { useStoredAcademicYear: false },
      )
    : Promise.resolve([]);
  const [transactionRows, comparisonRows, lastTwoRows] = await Promise.all([
    transactionRowsPromise,
    comparisonRowsPromise,
    lastTwoRowsPromise,
  ]);
  const comparisonEnabled = Boolean(
    filters.academicYear || filters.fromDate || filters.toDate,
  );

  const rows = transactionRows
    .map(toTransactionRow)
    .filter((row) => !filters.academicYear || academicYearFromMonth(row.month) === filters.academicYear);
  const previousRows = comparisonRows
    .map(toTransactionRow)
    .filter((row) => !previousYear || academicYearFromMonth(row.month) === previousYear);
  const lastTwoRowsForComparison = lastTwoRows
    .map(toTransactionRow)
    .filter((row) => !lastTwoYear || academicYearFromMonth(row.month) === lastTwoYear);
  const productById = new Map(products.map((row) => [row.product_id, row.product_code]));
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const regionById = new Map(regions.map((row) => [row.region_id, row.region_name]));
  const gradeLevelById = new Map(
    grades.map((row) => {
      const match = row.grade.match(/(SD|SMP|SMA)$/);
      return [row.grade_id, match?.[1] ?? "Other"];
    }),
  );
  const branchRegionById = new Map(
    branches.map((row) => [
      row.branch_id,
      row.region_id === null ? null : regionById.get(row.region_id),
    ]),
  );
  const targetBranchAllowed = (branchId: number) =>
    (regionBranchIds === null || regionBranchIds.includes(branchId)) &&
    (filters.branchId === undefined || filters.branchId === branchId);
  const annualTargetByBranch = new Map<number, number>();
  for (const target of annualTargets) {
    if (target.academic_year !== filters.academicYear || !targetBranchAllowed(target.branch_id)) continue;
    annualTargetByBranch.set(
      target.branch_id,
      (annualTargetByBranch.get(target.branch_id) ?? 0) + parseRevenue(target.target_revenue),
    );
  }
  const monthlyTargetByMonth = new Map<number, number>();
  for (const target of monthlyTargets) {
    if (target.academic_year !== filters.academicYear || !targetBranchAllowed(target.branch_id)) continue;
    monthlyTargetByMonth.set(
      target.month_number,
      (monthlyTargetByMonth.get(target.month_number) ?? 0) + parseRevenue(target.target_revenue),
    );
  }
  const targetAnnualRevenue = Array.from(annualTargetByBranch.values()).reduce((sum, value) => sum + value, 0);
  const invoices = new Set(rows.map((row) => row.invoice).filter(Boolean));
  const branchIds = new Set(rows.flatMap((row) => [row.branchId]).filter((id): id is number => id !== null));
  const agentIds = new Set(rows.map((row) => row.agentId).filter((id): id is number => id !== null));
  const knownSchools = new Set(
    rows.map((row) => row.npsn).filter((npsn): npsn is string => npsn !== null),
  );
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const nonBulkRows = rows.filter((row) => !row.isBulkBuying);
  const nonBulkRevenue = nonBulkRows.reduce((sum, row) => sum + row.revenue, 0);
  const nonBulkNewTransactions = nonBulkRows.filter((row) => row.isNewTxn).length;
  const monthlyMap = new Map<string, SummaryPoint>();

  for (const row of rows) {
    const current = monthlyMap.get(row.month) ?? {
      name: row.month,
      revenue: 0,
      transactions: 0,
    };
    current.revenue += row.revenue;
    current.transactions += 1;
    monthlyMap.set(row.month, current);
  }

  const missing = (name: string, count: number) => ({
    name,
    revenue: count,
    transactions: rows.length - count,
  });

  const currentByMonth = new Map<string, SummaryPoint>();
  const previousByMonth = new Map<string, SummaryPoint>();
  const lastTwoByMonth = new Map<string, SummaryPoint>();
  for (const row of rows) {
    const label = monthLabel(row.month);
    const current = currentByMonth.get(label) ?? {
      name: label,
      revenue: 0,
      transactions: 0,
    };
    current.revenue += row.revenue;
    current.transactions += 1;
    currentByMonth.set(label, current);
  }
  for (const row of previousRows) {
    const label = monthLabel(row.month);
    const current = previousByMonth.get(label) ?? {
      name: label,
      revenue: 0,
      transactions: 0,
    };
    current.revenue += row.revenue;
    current.transactions += 1;
    previousByMonth.set(label, current);
  }
  for (const row of lastTwoRowsForComparison) {
    const label = monthLabel(row.month);
    const current = lastTwoByMonth.get(label) ?? {
      name: label,
      revenue: 0,
      transactions: 0,
    };
    current.revenue += row.revenue;
    current.transactions += 1;
    lastTwoByMonth.set(label, current);
  }

  const monthKeys = new Set([...currentByMonth.keys(), ...previousByMonth.keys(), ...lastTwoByMonth.keys()]);
  const monthlyRevenueComparison: MonthlyComparisonPoint[] = Array.from(monthKeys)
    .sort(
      (a, b) =>
        academicYearMonthOrder.indexOf(a) - academicYearMonthOrder.indexOf(b),
    )
    .map((month) => ({
      month,
      currentRevenue: currentByMonth.get(month)?.revenue ?? 0,
      currentCumulativeRevenue: 0,
      currentTransactions: currentByMonth.get(month)?.transactions ?? 0,
      previousRevenue: previousYear ? previousByMonth.get(month)?.revenue ?? 0 : null,
      previousCumulativeRevenue: previousYear ? 0 : null,
      previousTransactions: previousYear
        ? previousByMonth.get(month)?.transactions ?? 0
        : null,
      lastTwoYearsRevenue: lastTwoYear ? lastTwoByMonth.get(month)?.revenue ?? 0 : null,
      lastTwoYearsCumulativeRevenue: 0,
      targetRevenue: monthlyTargetByMonth.get(academicMonthNumber(month) ?? -1) ?? 0,
      targetCumulativeRevenue: 0,
    }));

  let currentCumulativeRevenue = 0;
  let previousCumulativeRevenue = 0;
  let lastTwoCumulativeRevenue = 0;
  let targetCumulativeRevenue = 0;
  for (const row of monthlyRevenueComparison) {
    currentCumulativeRevenue += row.currentRevenue;
    row.currentCumulativeRevenue = currentCumulativeRevenue;

    if (row.previousRevenue !== null) {
      previousCumulativeRevenue += row.previousRevenue;
      row.previousCumulativeRevenue = previousCumulativeRevenue;
    }
    if (row.lastTwoYearsRevenue !== null) {
      lastTwoCumulativeRevenue += row.lastTwoYearsRevenue;
      row.lastTwoYearsCumulativeRevenue = lastTwoCumulativeRevenue;
    }
    targetCumulativeRevenue += row.targetRevenue ?? 0;
    row.targetCumulativeRevenue = targetCumulativeRevenue;
  }

  const agentPerformanceMap = new Map<number, AgentPerformance>();
  for (const row of nonBulkRows) {
    if (row.agentId === null) continue;
    const current = agentPerformanceMap.get(row.agentId) ?? {
      agent: agentById.get(row.agentId) ?? `Agent #${row.agentId}`,
      branch: labelForId(row.branchId, branchById, "Branch"),
      schools: 0,
      revenueNonBulkBuying: 0,
      revenueNewTxnNonBulkBuying: 0,
      newTxnNonBulkBuying: 0,
      transactionsNonBulkBuying: 0,
    };
    current.revenueNonBulkBuying += row.revenue;
    if (row.isNewTxn) current.revenueNewTxnNonBulkBuying += row.revenue;
    current.transactionsNonBulkBuying += 1;
    if (row.isNewTxn) current.newTxnNonBulkBuying += 1;
    if (row.npsn) current.schools += 1;
    agentPerformanceMap.set(row.agentId, current);
  }
  const agentPerformance = Array.from(agentPerformanceMap.values())
    .sort((a, b) => b.revenueNonBulkBuying - a.revenueNonBulkBuying);

  return {
    filters: {
      academicYears: academicYears
        .sort((a, b) => b.academic_year.localeCompare(a.academic_year))
        .map((row): FilterOption => ({ id: row.academic_year, label: row.academic_year })),
      regions: regions
        .filter((row) => branchScope === null || availableBranches.some((branch) => branch.region_id === row.region_id))
        .sort((a, b) => a.region_name.localeCompare(b.region_name))
        .map((row): FilterOption => ({ id: String(row.region_id), label: row.region_name })),
      branches: availableBranches
        .filter((row) => row.region_id !== null)
        .sort((a, b) => a.branch_name.localeCompare(b.branch_name))
        .map(
          (row): BranchFilterOption => ({
            id: String(row.branch_id),
            label: row.branch_name,
            regionId: String(row.region_id),
          }),
        ),
      months: academicYearMonthOrder.map((month) => ({
        id: month,
        label: month,
      })),
    },
    kpis: {
      totalRevenue,
      totalTransactions: rows.length,
      uniqueInvoices: invoices.size,
      activeBranches: branchIds.size,
      activeAgents: agentIds.size,
      knownSchools: knownSchools.size,
      averageOrderValue: rows.length ? totalRevenue / rows.length : 0,
      nonBulkRevenue,
      nonBulkNewTransactions,
      targetAnnualRevenue,
      achievement: targetAnnualRevenue ? totalRevenue / targetAnnualRevenue : null,
      varianceToTarget: totalRevenue - targetAnnualRevenue,
      growthVsLy: previousRows.length
        ? totalRevenue / previousRows.reduce((sum, row) => sum + row.revenue, 0)
        : null,
      growthVsL2y: lastTwoRowsForComparison.length
        ? totalRevenue / lastTwoRowsForComparison.reduce((sum, row) => sum + row.revenue, 0)
        : null,
    },
    monthlyRevenue: Array.from(monthlyMap.values())
      .sort((a, b) => monthSortValue(a.name) - monthSortValue(b.name))
      .map((point) => ({ ...point, period: point.name })),
    monthlyRevenueComparison: {
      currentAcademicYear: filters.academicYear ?? (comparisonEnabled ? "Active period" : null),
      previousAcademicYear:
        previousYear ?? (comparisonEnabled ? "Previous-year period" : null),
      rows: monthlyRevenueComparison,
    },
    regionalRevenue: summarize(
      rows,
      (row) => row.branchId === null ? "(empty)" : branchRegionById.get(row.branchId) ?? "(empty)",
    ),
    regionalRevenueSource: summarizeRevenueSource(
      rows,
      (row) => row.branchId === null ? "(empty)" : branchRegionById.get(row.branchId) ?? "(empty)",
    ),
    branchRevenue: summarize(
      rows,
      (row) => labelForId(row.branchId, branchById, "Branch"),
      12,
    ),
    branchRevenuePerformance: summarizeBranchRevenuePerformance(rows, availableBranches, annualTargetByBranch),
    productRevenue: summarize(
      rows,
      (row) => labelForId(row.productId, productById, "Product"),
    ),
    productRevenueRetail: summarize(
      rows.filter((row) => !row.isBulkBuying),
      (row) => labelForId(row.productId, productById, "Product"),
    ),
    paymentCategoryRevenue: [
      {
        name: "New Txn / Down Payment",
        revenue: rows.filter((row) => row.isNewTxn).reduce((sum, row) => sum + row.revenue, 0),
        transactions: rows.filter((row) => row.isNewTxn).length,
      },
      {
        name: "Full Payment",
        revenue: rows.filter((row) => row.isFullPayment).reduce((sum, row) => sum + row.revenue, 0),
        transactions: rows.filter((row) => row.isFullPayment).length,
      },
      {
        name: "Bulk Buying",
        revenue: rows.filter((row) => row.isBulkBuying).reduce((sum, row) => sum + row.revenue, 0),
        transactions: rows.filter((row) => row.isBulkBuying).length,
      },
    ],
    levelRevenue: summarize(
      rows,
      (row) => row.gradeId === null ? "(empty)" : gradeLevelById.get(row.gradeId) ?? "Other",
    ),
    dataQuality: [
      missing("Grade ID empty", rows.filter((row) => row.gradeId === null).length),
      missing("Agent ID empty", rows.filter((row) => row.agentId === null).length),
      missing(
        "Destination branch empty",
        rows.filter((row) => row.branchDestinationId === null).length,
      ),
      missing("NPSN empty", rows.filter((row) => row.npsn === null).length),
    ],
    recentTransactions: rows.slice(0, 10).map((row) => ({
      id: row.id,
      paymentDate: row.paymentDate,
      invoice: row.invoice,
      product: labelForId(row.productId, productById, "Product"),
      branch: labelForId(row.branchId, branchById, "Branch"),
      revenue: row.revenue,
      flags: [
        row.isNewTxn ? "New Txn" : "",
        row.isFullPayment ? "Full Payment" : "",
        row.isBulkBuying ? "Bulk Buying" : "",
      ].filter(Boolean),
    })),
    agentPerformance,
  };
}
