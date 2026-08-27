import { supabaseRpcFetch, supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";
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

async function fetchAll<T>(
  table: string,
  select: string,
  pageSize = 1000,
  init: SupabaseFetchInit = {},
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const params = new URLSearchParams({
      select,
      limit: String(pageSize),
      offset: String(from),
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
    if (filters.branchId) params.set("branch_id", `eq.${filters.branchId}`);
    if (filters.month) params.set("month", `ilike.${filters.month} %`);
    if (filters.fromDate) params.append("payment_date", `gte.${filters.fromDate}`);
    if (filters.toDate) params.append("payment_date", `lte.${filters.toDate}`);
    if (branchIds) {
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
  return id === null ? "(kosong)" : labels.get(id) ?? `${prefix} #${id}`;
}

function summarize(
  rows: TransactionRow[],
  key: (row: TransactionRow) => string,
  limit?: number,
) {
  const grouped = new Map<string, SummaryPoint>();

  for (const row of rows) {
    const name = key(row) || "(kosong)";
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
    const name = key(row) || "(kosong)";
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
  targetRevenue: number,
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
      target: targetRevenue,
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

function previousYearDate(date: string | undefined) {
  if (!date) return undefined;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const previousYear = year - 1;
  const lastDayOfMonth = new Date(Date.UTC(previousYear, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return `${previousYear}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export async function getDashboardData(
  filters: DashboardFilters = {},
): Promise<DashboardData> {
  const academicYearOptions = await getRevenueAcademicYearOptions();
  const selectedAcademicYear =
    filters.academicYear && academicYearOptions.some((option) => option.id === filters.academicYear)
      ? filters.academicYear
      : academicYearOptions[0]?.id;
  const selectedFilters = {
    ...filters,
    academicYear: selectedAcademicYear,
  };

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
    const dashboard = normalizeDashboardPayload(payload);
    dashboard.filters.academicYears = academicYearOptions;
    return dashboard;
  }

  const errorText = await response.text();
  if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
    throw new Error(`Dashboard RPC gagal: ${errorText}`);
  }

  return getDashboardDataLegacy(selectedFilters);
}

export async function getLatestRevenuePaymentDate() {
  const response = await supabaseRestFetch(
    "t_revenue_txn?select=payment_date,month,academic_year&order=payment_date.desc&limit=1",
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );
  if (!response.ok) throw new Error(`Latest revenue date gagal: ${await response.text()}`);
  const rows = (await response.json()) as Array<{ payment_date?: string; month?: string; academic_year?: string }>;
  const latest = rows[0];
  if (!latest?.payment_date || !latest.academic_year) return { latestDate: latest?.payment_date ?? null, startDate: null };
  const startResponse = await supabaseRestFetch(
    `t_revenue_txn?select=payment_date&academic_year=eq.${encodeURIComponent(latest.academic_year)}&month=ilike.Jul%20%25&order=payment_date.asc&limit=1`,
    { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
  );
  if (!startResponse.ok) throw new Error(`Revenue start date gagal: ${await startResponse.text()}`);
  const starts = (await startResponse.json()) as Array<{ payment_date?: string }>;
  return { latestDate: latest.payment_date, startDate: starts[0]?.payment_date ?? null };
}

export async function getBulkBuyingGrowth(academicYear: string, fromDate: string, toDate: string) {
  const response = await supabaseRpcFetch("get_bulk_buying_growth", {
    p_academic_year: academicYear, p_from_date: fromDate, p_to_date: toDate,
  }, { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  if (!response.ok) throw new Error(`Bulk buying RPC gagal: ${await response.text()}`);
  const value = await response.json() as { currentRevenue?: number; previousRevenue?: number };
  return { currentRevenue: Number(value.currentRevenue ?? 0), previousRevenue: Number(value.previousRevenue ?? 0) };
}

export async function getBranchRevenuePerformance(
  academicYear: string,
  regionId?: number,
  branchId?: number,
  month?: string,
) {
  const response = await supabaseRpcFetch("get_branch_revenue_performance", {
    p_academic_year: academicYear,
    p_region_id: regionId ?? null,
    p_branch_id: branchId ?? null,
    p_month: month ?? null,
  }, { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  if (!response.ok) throw new Error(`Branch performance RPC gagal: ${await response.text()}`);
  return (await response.json()) as DashboardData["branchRevenuePerformance"];
}

export async function getBranchRevenueSummary(academicYear: string) {
  const [branches, rows] = await Promise.all([
    fetchAll<BranchLookup>("t_branch", "branch_id,branch_name,region_id", 1000, {
      next: { revalidate: 30, tags: ["revenue-dashboard"] },
    }),
    fetchTransactions({}, null, {
      useStoredAcademicYear: false,
      init: { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    }),
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
      name: branchMap.get(row.branch_id) ?? "Branch tidak ditemukan",
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
    product: String(row.product ?? "(kosong)"),
    branch: String(row.branch ?? "(kosong)"),
    revenue: Number(row.revenue ?? 0),
    flags: Array.isArray(row.flags) ? row.flags.map(String) : [],
  }));
  const agentPerformance = (
    (payload.agentPerformance ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    agent: String(row.agent ?? "(Agent tidak terpetakan)"),
    branch: String(row.branch ?? "(kosong)"),
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
): Promise<DashboardData> {
  const [grades, products, agents, branches, regions, academicYears] = await Promise.all([
    fetchAll<GradeLookup>("t_grade", "grade_id,grade"),
    fetchAll<ProductLookup>("t_revenue_products", "product_id,product_code"),
    fetchAll<AgentLookup>("t_agent", "agent_id,agent_name"),
    fetchAll<BranchLookup>("t_branch", "branch_id,branch_name,region_id"),
    fetchAll<RegionLookup>("t_region", "region_id,region_name"),
    fetchAll<{ academic_year: string }>("t_academic_year", "academic_year"),
  ]);

  const regionBranchIds =
    filters.regionId === undefined
      ? null
      : branches
          .filter((branch) => branch.region_id === filters.regionId)
          .map((branch) => branch.branch_id);
  const transactionRows = await fetchTransactions(filters, regionBranchIds, {
    useStoredAcademicYear: false,
  });
  const allAcademicYears = academicYears.map((row) => row.academic_year);
  const previousYear = previousAcademicYear(filters.academicYear, allAcademicYears);
  const comparisonRows = filters.academicYear
    ? await fetchTransactions(
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
      ? await fetchTransactions(
          {
            ...filters,
            academicYear: undefined,
            fromDate: previousYearDate(filters.fromDate),
            toDate: previousYearDate(filters.toDate),
        },
        regionBranchIds,
        { useStoredAcademicYear: false },
      )
    : [];
  const comparisonEnabled = Boolean(
    filters.academicYear || filters.fromDate || filters.toDate,
  );

  const rows = transactionRows
    .map(toTransactionRow)
    .filter((row) => !filters.academicYear || academicYearFromMonth(row.month) === filters.academicYear);
  const previousRows = comparisonRows
    .map(toTransactionRow)
    .filter((row) => !previousYear || academicYearFromMonth(row.month) === previousYear);
  const productById = new Map(products.map((row) => [row.product_id, row.product_code]));
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const regionById = new Map(regions.map((row) => [row.region_id, row.region_name]));
  const gradeLevelById = new Map(
    grades.map((row) => {
      const match = row.grade.match(/(SD|SMP|SMA)$/);
      return [row.grade_id, match?.[1] ?? "Lainnya"];
    }),
  );
  const branchRegionById = new Map(
    branches.map((row) => [
      row.branch_id,
      row.region_id === null ? null : regionById.get(row.region_id),
    ]),
  );
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

  const monthKeys = new Set([...currentByMonth.keys(), ...previousByMonth.keys()]);
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
      lastTwoYearsRevenue: null,
      lastTwoYearsCumulativeRevenue: null,
      targetRevenue: null,
      targetCumulativeRevenue: null,
    }));

  let currentCumulativeRevenue = 0;
  let previousCumulativeRevenue = 0;
  for (const row of monthlyRevenueComparison) {
    currentCumulativeRevenue += row.currentRevenue;
    row.currentCumulativeRevenue = currentCumulativeRevenue;

    if (row.previousRevenue !== null) {
      previousCumulativeRevenue += row.previousRevenue;
      row.previousCumulativeRevenue = previousCumulativeRevenue;
    }
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
        .sort((a, b) => a.region_name.localeCompare(b.region_name))
        .map((row): FilterOption => ({ id: String(row.region_id), label: row.region_name })),
      branches: branches
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
      targetAnnualRevenue: 0,
      achievement: null,
      varianceToTarget: 0,
      growthVsLy: null,
      growthVsL2y: null,
    },
    monthlyRevenue: Array.from(monthlyMap.values())
      .sort((a, b) => monthSortValue(a.name) - monthSortValue(b.name))
      .map((point) => ({ ...point, period: point.name })),
    monthlyRevenueComparison: {
      currentAcademicYear: filters.academicYear ?? (comparisonEnabled ? "Periode aktif" : null),
      previousAcademicYear:
        previousYear ?? (comparisonEnabled ? "Periode tahun lalu" : null),
      rows: monthlyRevenueComparison,
    },
    regionalRevenue: summarize(
      rows,
      (row) => row.branchId === null ? "(kosong)" : branchRegionById.get(row.branchId) ?? "(kosong)",
    ),
    regionalRevenueSource: summarizeRevenueSource(
      rows,
      (row) => row.branchId === null ? "(kosong)" : branchRegionById.get(row.branchId) ?? "(kosong)",
    ),
    branchRevenue: summarize(
      rows,
      (row) => labelForId(row.branchId, branchById, "Branch"),
      12,
    ),
    branchRevenuePerformance: summarizeBranchRevenuePerformance(rows, branches, 0),
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
      (row) => row.gradeId === null ? "(kosong)" : gradeLevelById.get(row.gradeId) ?? "Lainnya",
    ),
    dataQuality: [
      missing("Grade ID kosong", rows.filter((row) => row.gradeId === null).length),
      missing("Agent ID kosong", rows.filter((row) => row.agentId === null).length),
      missing(
        "Destination branch kosong",
        rows.filter((row) => row.branchDestinationId === null).length,
      ),
      missing("NPSN kosong", rows.filter((row) => row.npsn === null).length),
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
