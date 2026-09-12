import { supabaseRpcFetch, supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";
import type { LatestRetailTransaction } from "@/lib/types";
import {
  DashboardBranchScope,
  getDashboardBranchScope,
  resolveScopedBranchId,
} from "@/lib/dashboard-access";

type AgentAnalyticsRow = {
  agent: string;
  branch: string;
  schools: number;
  revenueNonBulkBuying: number | string;
  revenueNewTxnNonBulkBuying: number | string;
  newTxnNonBulkBuying: number | string;
  transactionsNonBulkBuying: number | string;
};

type ProductAnalyticsRow = {
  product: string;
  revenue: number | string;
  transactions: number | string;
  invoices: number | string;
  bulkBuying?: boolean;
};

export type AgentProductRevenueRow = {
  agent: string;
  branch: string;
  products: { product: string; revenue: number }[];
};

export type ProductRevenueComparison = {
  ly: Map<string, number>;
  l2y: Map<string, number>;
};

export type SchoolCityOption = {
  city: string;
  province: string | null;
};

type SchoolAnalyticsRow = {
  npsn: string;
  school: string;
  city: string | null;
  revenue: number | string;
  transactions: number | string;
  invoices: number | string;
  branches: Array<{
    branch: string;
    revenue: number | string;
    transactions: number | string;
  }>;
};

type AnalyticsTransaction = {
  id?: number;
  payment_date: string;
  month: string;
  academic_year: string | null;
  agent_id: number | null;
  branch_id: number | null;
  product_id: number | null;
  npsn: string | null;
  invoice: string;
  revenue: number | string | null;
  is_newtxn: boolean;
  is_bulkbuying: boolean;
};

type AnalyticsBranch = {
  branch_id: number;
  branch_name: string;
  region_id: number | null;
};

type AnalyticsAgent = {
  agent_id: number;
  agent_name: string;
};

type AnalyticsProduct = {
  product_id: number;
  product_name: string | null;
  product_code: string | null;
};

type AnalyticsSchool = {
  npsn: string;
  name: string;
  city: string | null;
  province: string | null;
  level: string | null;
};

async function fetchAll<T>(
  path: string,
  select: string,
  query: Record<string, string> = {},
  init: SupabaseFetchInit = {},
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select,
      limit: "1000",
      offset: String(offset),
      ...query,
    });
    const response = await supabaseRestFetch(`${path}?${params.toString()}`, init);
    if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function academicYearFromMonth(month: string) {
  const match = month.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const year = Number(match[2]);
  if (["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].includes(match[1])) {
    return `${String(year % 100).padStart(2, "0")}/${String((year + 1) % 100).padStart(2, "0")}`;
  }
  if (["Jan", "Feb", "Mar", "Apr", "May", "Jun"].includes(match[1])) {
    return `${String((year - 1) % 100).padStart(2, "0")}/${String(year % 100).padStart(2, "0")}`;
  }
  return null;
}

function academicYearStartYear(academicYear: string) {
  const match = academicYear.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const shortYear = Number(match[1]);
  return 2000 + shortYear;
}

function previousAcademicYear(academicYear: string | undefined, offset: number) {
  if (!academicYear) return null;
  const startYear = academicYearStartYear(academicYear);
  if (startYear === null) return null;
  const previousStartYear = startYear - offset;
  return `${String(previousStartYear % 100).padStart(2, "0")}/${String((previousStartYear + 1) % 100).padStart(2, "0")}`;
}

function shiftDate(date: string | undefined, years: number) {
  if (!date) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const shiftedYear = year + years;
  const lastDay = new Date(Date.UTC(shiftedYear, month, 0)).getUTCDate();
  return `${shiftedYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

type AcademicYearBounds = {
  startDate: string | null;
  latestDate: string | null;
};

async function getAcademicYearBounds(
  academicYear: string,
  branchScope: DashboardBranchScope,
  selectedBranchId?: number,
  selectedRegionId?: number,
  selectedMonth?: string,
): Promise<AcademicYearBounds> {
  const startYear = academicYearStartYear(academicYear);
  if (startYear === null || (branchScope !== null && !branchScope.length)) {
    return { startDate: null, latestDate: null };
  }

  let branchFilters = branchQuery(branchScope, selectedBranchId);
  if (selectedRegionId !== undefined) {
    const branches = await fetchAll<AnalyticsBranch>(
      "t_branch",
      "branch_id,branch_name,region_id",
      branchQuery(branchScope),
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    );
    const regionBranchIds = branches
      .filter((branch) => branch.region_id === selectedRegionId)
      .map((branch) => branch.branch_id);
    if (selectedBranchId !== undefined) {
      branchFilters = regionBranchIds.includes(selectedBranchId)
        ? branchIdsQuery([selectedBranchId])
        : branchIdsQuery([]);
    } else {
      branchFilters = branchIdsQuery(regionBranchIds);
    }
  }
  const academicMonths = [
    `Jul ${startYear}`,
    `Aug ${startYear}`,
    `Sep ${startYear}`,
    `Oct ${startYear}`,
    `Nov ${startYear}`,
    `Dec ${startYear}`,
    `Jan ${startYear + 1}`,
    `Feb ${startYear + 1}`,
    `Mar ${startYear + 1}`,
    `Apr ${startYear + 1}`,
    `May ${startYear + 1}`,
    `Jun ${startYear + 1}`,
  ];
  const makeParams = (order: "asc" | "desc") => {
    const params = new URLSearchParams({
      select: "payment_date,month",
      order: `payment_date.${order}`,
      limit: "1000",
      month: `in.(${academicMonths.map((month) => `"${month}"`).join(",")})`,
    });
    if (selectedMonth) {
      const monthYear = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].includes(selectedMonth)
        ? startYear
        : startYear + 1;
      params.set("month", `eq.${selectedMonth} ${monthYear}`);
    }
    Object.entries(branchFilters).forEach(([key, value]) => params.set(key, value));
    return params;
  };

  const [startResponse, latestResponse] = await Promise.all([
    supabaseRestFetch(
      `t_revenue_txn?${(() => {
        const params = makeParams("asc");
        params.set("month", `eq.Jul ${startYear}`);
        params.set("limit", "1");
        return params.toString();
      })()}`,
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
    supabaseRestFetch(
      `t_revenue_txn?${makeParams("desc").toString()}`,
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
  ]);

  if (!startResponse.ok) throw new Error(`Product start date request failed: ${await startResponse.text()}`);
  if (!latestResponse.ok) throw new Error(`Product latest date request failed: ${await latestResponse.text()}`);

  const startRows = (await startResponse.json()) as Array<{ payment_date?: string; month?: string }>;
  const latestRows = (await latestResponse.json()) as Array<{ payment_date?: string; month?: string }>;
  const startDate = startRows.find(
    (row) => row.payment_date && row.month && academicYearFromMonth(row.month) === academicYear,
  )?.payment_date ?? null;
  const latestDate = latestRows.find(
    (row) => row.payment_date && row.month && academicYearFromMonth(row.month) === academicYear,
  )?.payment_date ?? null;

  return { startDate, latestDate };
}

function parseRevenue(value: number | string | null) {
  return Number(value ?? 0) || 0;
}

function dateMatches(row: AnalyticsTransaction, fromDate?: string, toDate?: string) {
  return (!fromDate || row.payment_date >= fromDate) && (!toDate || row.payment_date <= toDate);
}

function branchQuery(scope: DashboardBranchScope, selectedBranchId?: number): Record<string, string> {
  if (scope === null) return selectedBranchId === undefined ? {} : { branch_id: `eq.${selectedBranchId}` };
  const ids = selectedBranchId === undefined ? scope : [selectedBranchId];
  return ids.length ? { branch_id: `in.(${ids.join(",")})` } : { branch_id: "in.(-1)" };
}

function branchIdsQuery(branchIds: number[]): Record<string, string> {
  return branchIds.length ? { branch_id: `in.(${branchIds.join(",")})` } : { branch_id: "in.(-1)" };
}

async function readRpc<T>(functionName: string, body: Record<string, unknown> = {}) {
  const response = await supabaseRpcFetch(functionName, body);
  if (!response.ok) {
    throw new Error(`${functionName}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

function isMissingRpcError(error: unknown) {
  return error instanceof Error && (error.message.includes("PGRST202") || error.message.includes("PGRST205"));
}

async function getAgentAnalyticsLocal(
  filters: {
    academicYear?: string;
    regionId?: number;
    branchId?: number;
    month?: string;
    fromDate?: string;
    toDate?: string;
  },
  scope: DashboardBranchScope,
) {
  if (scope !== null && !scope.length) return [];
  const selectedBranchId = resolveScopedBranchId(scope, filters.branchId);
  const branches = await fetchAll<AnalyticsBranch>("t_branch", "branch_id,branch_name,region_id", branchQuery(scope), { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  const regionBranches = filters.regionId === undefined
    ? branches
    : branches.filter((branch) => branch.region_id === filters.regionId);
  if (selectedBranchId !== undefined && !regionBranches.some((branch) => branch.branch_id === selectedBranchId)) return [];
  const allowedBranchIds = selectedBranchId !== undefined
    ? [selectedBranchId]
    : filters.regionId === undefined ? null : regionBranches.map((branch) => branch.branch_id);
  const transactionQuery = allowedBranchIds === null ? branchQuery(scope) : branchIdsQuery(allowedBranchIds);
  const [transactions, agents] = await Promise.all([
    fetchAll<AnalyticsTransaction>(
      "t_revenue_txn",
      "payment_date,month,academic_year,agent_id,branch_id,product_id,npsn,invoice,revenue,is_newtxn,is_bulkbuying",
      transactionQuery,
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
    fetchAll<AnalyticsAgent>("t_agent", "agent_id,agent_name", {}, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }),
  ]);
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const branchById = new Map(regionBranches.map((row) => [row.branch_id, row.branch_name]));
  const grouped = new Map<string, {
    agent: string;
    branch: string;
    schools: Set<string>;
    revenueNonBulkBuying: number;
    revenueNewTxnNonBulkBuying: number;
    newTxnNonBulkBuying: number;
    transactionsNonBulkBuying: number;
  }>();
  for (const row of transactions) {
    if (row.agent_id === null || row.is_bulkbuying ||
      (filters.academicYear && academicYearFromMonth(row.month) !== filters.academicYear) ||
      (filters.month && row.month.split(" ")[0] !== filters.month) ||
      !dateMatches(row, filters.fromDate, filters.toDate)) continue;
    const key = `${row.agent_id}:${row.branch_id ?? "null"}`;
    const current = grouped.get(key) ?? {
      agent: agentById.get(row.agent_id) ?? `Agent #${row.agent_id}`,
      branch: row.branch_id === null ? "(empty)" : branchById.get(row.branch_id) ?? `Branch #${row.branch_id}`,
      schools: new Set<string>(),
      revenueNonBulkBuying: 0,
      revenueNewTxnNonBulkBuying: 0,
      newTxnNonBulkBuying: 0,
      transactionsNonBulkBuying: 0,
    };
    current.revenueNonBulkBuying += parseRevenue(row.revenue);
    current.transactionsNonBulkBuying += 1;
    if (row.is_newtxn) {
      current.revenueNewTxnNonBulkBuying += parseRevenue(row.revenue);
      current.newTxnNonBulkBuying += 1;
    }
    if (row.npsn) current.schools.add(row.npsn);
    grouped.set(key, current);
  }
  return Array.from(grouped.values())
    .map((row) => ({
      agent: row.agent,
      branch: row.branch,
      schools: row.schools.size,
      revenueNonBulkBuying: row.revenueNonBulkBuying,
      revenueNewTxnNonBulkBuying: row.revenueNewTxnNonBulkBuying,
      newTxnNonBulkBuying: row.newTxnNonBulkBuying,
      transactionsNonBulkBuying: row.transactionsNonBulkBuying,
    }))
    .sort((a, b) => b.revenueNonBulkBuying - a.revenueNonBulkBuying || a.agent.localeCompare(b.agent));
}

export async function getAgentAnalytics(filters: {
  academicYear?: string;
  regionId?: number;
  branchId?: number;
  month?: string;
  fromDate?: string;
  toDate?: string;
}, branchScope?: DashboardBranchScope) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null || filters.regionId !== undefined) {
    return getAgentAnalyticsLocal(filters, scope);
  }
  try {
    const rows = await readRpc<AgentAnalyticsRow[]>("get_agent_performance", {
      p_academic_year: filters.academicYear || null,
      p_branch_id: filters.branchId ?? null,
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_month: filters.month || null,
    });
    return rows.map((row) => ({
      agent: row.agent,
      branch: row.branch,
      schools: Number(row.schools),
      revenueNonBulkBuying: Number(row.revenueNonBulkBuying),
      revenueNewTxnNonBulkBuying: Number(row.revenueNewTxnNonBulkBuying),
      newTxnNonBulkBuying: Number(row.newTxnNonBulkBuying),
      transactionsNonBulkBuying: Number(row.transactionsNonBulkBuying),
    }));
  } catch (error) {
    if (!isMissingRpcError(error)) throw error;
    return getAgentAnalyticsLocal(filters, scope);
  }
}

export async function getAgentProductRevenue(
  filters: {
    academicYear?: string;
    regionId?: number;
    branchId?: number;
    month?: string;
    fromDate?: string;
    toDate?: string;
  },
  branchScope?: DashboardBranchScope,
): Promise<AgentProductRevenueRow[]> {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return [];
  const selectedBranchId = resolveScopedBranchId(scope, filters.branchId);
  const branches = await fetchAll<AnalyticsBranch>("t_branch", "branch_id,branch_name,region_id", branchQuery(scope), { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  const regionBranches = filters.regionId === undefined ? branches : branches.filter((branch) => branch.region_id === filters.regionId);
  if (selectedBranchId !== undefined && !regionBranches.some((branch) => branch.branch_id === selectedBranchId)) return [];
  const allowedBranchIds = selectedBranchId !== undefined
    ? [selectedBranchId]
    : filters.regionId === undefined ? null : regionBranches.map((branch) => branch.branch_id);
  const branchFilters = allowedBranchIds === null ? branchQuery(scope) : branchIdsQuery(allowedBranchIds);
  const [transactions, agents, products] = await Promise.all([
    fetchAll<AnalyticsTransaction>(
      "t_revenue_txn",
      "payment_date,month,academic_year,agent_id,branch_id,product_id,npsn,invoice,revenue,is_newtxn,is_bulkbuying",
      branchFilters,
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
    fetchAll<AnalyticsAgent>(
      "t_agent",
      "agent_id,agent_name",
      {},
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
    fetchAll<AnalyticsProduct>(
      "t_revenue_products",
      "product_id,product_name,product_code",
      {},
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
  ]);
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const branchById = new Map(regionBranches.map((row) => [row.branch_id, row.branch_name]));
  const productById = new Map(products.map((row) => [row.product_id, row]));
  const grouped = new Map<string, Map<string, { product: string; revenue: number }>>();

  for (const row of transactions) {
    if (
      row.agent_id === null ||
      row.is_bulkbuying ||
      (filters.academicYear && academicYearFromMonth(row.month) !== filters.academicYear) ||
      (filters.month && row.month.split(" ")[0] !== filters.month) ||
      !dateMatches(row, filters.fromDate, filters.toDate)
    ) continue;
    const agentBranchKey = `${row.agent_id}:${row.branch_id ?? "null"}`;
    const productKey = String(row.product_id ?? "null");
    const productLookup = row.product_id === null ? undefined : productById.get(row.product_id);
    const product = productLookup?.product_name || productLookup?.product_code ||
      (row.product_id === null ? "(Unmapped)" : `Product #${row.product_id}`);
    const productRows = grouped.get(agentBranchKey) ?? new Map<string, { product: string; revenue: number }>();
    const current = productRows.get(productKey) ?? { product, revenue: 0 };
    current.revenue += parseRevenue(row.revenue);
    productRows.set(productKey, current);
    grouped.set(agentBranchKey, productRows);
  }

  return Array.from(grouped.entries()).map(([key, productRows]) => {
    const [agentId, branchId] = key.split(":");
    const numericAgentId = Number(agentId);
    const numericBranchId = branchId === "null" ? null : Number(branchId);
    return {
      agent: agentById.get(numericAgentId) ?? `Agent #${agentId}`,
      branch: numericBranchId === null
        ? "(empty)"
        : branchById.get(numericBranchId) ?? `Branch #${numericBranchId}`,
      products: Array.from(productRows.values()).sort(
        (left, right) => right.revenue - left.revenue || left.product.localeCompare(right.product),
      ),
    };
  });
}

async function getProductAnalyticsLocal(
  filters: {
    academicYear?: string;
    regionId?: number;
    branchId?: number;
    month?: string;
    fromDate?: string;
    toDate?: string;
  },
  scope: DashboardBranchScope,
) {
  if (scope !== null && !scope.length) return [];
  const selectedBranchId = resolveScopedBranchId(scope, filters.branchId);
  const branches = await fetchAll<AnalyticsBranch>("t_branch", "branch_id,branch_name,region_id", branchQuery(scope), { next: { revalidate: 30, tags: ["revenue-dashboard"] } });
  const regionBranches = filters.regionId === undefined ? branches : branches.filter((branch) => branch.region_id === filters.regionId);
  if (selectedBranchId !== undefined && !regionBranches.some((branch) => branch.branch_id === selectedBranchId)) return [];
  const allowedBranchIds = selectedBranchId !== undefined
    ? [selectedBranchId]
    : filters.regionId === undefined ? null : regionBranches.map((branch) => branch.branch_id);
  const transactionQuery = allowedBranchIds === null ? branchQuery(scope) : branchIdsQuery(allowedBranchIds);
  const [transactions, products] = await Promise.all([
    fetchAll<AnalyticsTransaction>(
      "t_revenue_txn",
      "payment_date,month,academic_year,agent_id,branch_id,product_id,npsn,invoice,revenue,is_newtxn,is_bulkbuying",
      transactionQuery,
      { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
    ),
    fetchAll<AnalyticsProduct>("t_revenue_products", "product_id,product_name,product_code", {}, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }),
  ]);
  const productById = new Map(products.map((row) => [row.product_id, row]));
  const grouped = new Map<string, {
    product: string;
    bulkBuying: boolean;
    revenue: number;
    transactions: number;
    invoices: Set<string>;
  }>();
  for (const row of transactions) {
    if ((filters.academicYear && academicYearFromMonth(row.month) !== filters.academicYear) ||
      (filters.month && row.month.split(" ")[0] !== filters.month) ||
      !dateMatches(row, filters.fromDate, filters.toDate)) continue;
    const lookup = row.product_id === null ? undefined : productById.get(row.product_id);
    const product = lookup?.product_name || lookup?.product_code ||
      (row.product_id === null ? "(Unmapped)" : `Product #${row.product_id}`);
    const key = `${row.product_id ?? "null"}:${row.is_bulkbuying ? "bulk" : "retail"}`;
    const current = grouped.get(key) ?? {
      product,
      bulkBuying: row.is_bulkbuying,
      revenue: 0,
      transactions: 0,
      invoices: new Set<string>(),
    };
    current.revenue += parseRevenue(row.revenue);
    current.transactions += 1;
    if (row.invoice) current.invoices.add(row.invoice);
    grouped.set(key, current);
  }
  return Array.from(grouped.values())
    .map((row) => ({
      product: row.product,
      revenue: row.revenue,
      transactions: row.transactions,
      invoices: row.invoices.size,
      bulkBuying: row.bulkBuying,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.product.localeCompare(b.product));
}

export async function getProductAnalytics(filters: {
  academicYear?: string;
  regionId?: number;
  branchId?: number;
  month?: string;
  fromDate?: string;
  toDate?: string;
} = {}, branchScope?: DashboardBranchScope) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null || filters.regionId !== undefined) {
    return getProductAnalyticsLocal(filters, scope);
  }
  try {
    const rows = await readRpc<ProductAnalyticsRow[]>("get_product_sales", {
      p_academic_year: filters.academicYear || null,
      p_branch_id: filters.branchId ?? null,
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_month: filters.month || null,
    });
    return rows.map((row) => ({
      product: row.product,
      revenue: Number(row.revenue),
      transactions: Number(row.transactions),
      invoices: Number(row.invoices),
      bulkBuying: Boolean(row.bulkBuying),
    }));
  } catch (error) {
    if (!isMissingRpcError(error)) throw error;
    return getProductAnalyticsLocal(filters, scope);
  }
}

function productComparisonKey(product: string) {
  return product.trim().toLowerCase();
}

function productRevenueMap(rows: Awaited<ReturnType<typeof getProductAnalytics>>) {
  const revenueByProduct = new Map<string, number>();
  for (const row of rows) {
    if (row.bulkBuying) continue;
    revenueByProduct.set(productComparisonKey(row.product), row.revenue);
  }
  return revenueByProduct;
}

export async function getProductRevenueComparisons(
  filters: {
    academicYear?: string;
    regionId?: number;
    branchId?: number;
    month?: string;
    fromDate?: string;
    toDate?: string;
  },
  branchScope?: DashboardBranchScope,
): Promise<ProductRevenueComparison> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const currentAcademicYear = filters.academicYear;
  if (!currentAcademicYear || (scope !== null && !scope.length)) {
    return { ly: new Map(), l2y: new Map() };
  }

  const selectedBranchId = resolveScopedBranchId(scope, filters.branchId);
  const previousYear = previousAcademicYear(currentAcademicYear, 1);
  const lastTwoYear = previousAcademicYear(currentAcademicYear, 2);
  const yearsToResolve = [currentAcademicYear, previousYear, lastTwoYear].filter(
    (year): year is string => Boolean(year),
  );
  const bounds = new Map<string, AcademicYearBounds>();

  const resolvedBounds = await Promise.all(
    yearsToResolve.map(async (year) => [
      year,
      await getAcademicYearBounds(year, scope, selectedBranchId, filters.regionId, filters.month),
    ] as const),
  );
  resolvedBounds.forEach(([year, value]) => bounds.set(year, value));

  const currentToDate = filters.toDate ?? bounds.get(currentAcademicYear)?.latestDate ?? undefined;
  const previousFilters = previousYear
    ? {
      academicYear: previousYear,
      regionId: filters.regionId,
      branchId: selectedBranchId,
      month: filters.month,
      fromDate: filters.fromDate ? shiftDate(filters.fromDate, -1) : bounds.get(previousYear)?.startDate ?? undefined,
        toDate: currentToDate ? shiftDate(currentToDate, -1) : undefined,
      }
    : null;
  const lastTwoFilters = lastTwoYear
    ? {
      academicYear: lastTwoYear,
      regionId: filters.regionId,
      branchId: selectedBranchId,
      month: filters.month,
      fromDate: filters.fromDate ? shiftDate(filters.fromDate, -2) : bounds.get(lastTwoYear)?.startDate ?? undefined,
        toDate: currentToDate ? shiftDate(currentToDate, -2) : undefined,
      }
    : null;

  const [previousRows, lastTwoRows] = await Promise.all([
    previousFilters ? getProductAnalytics(previousFilters, scope) : Promise.resolve([]),
    lastTwoFilters ? getProductAnalytics(lastTwoFilters, scope) : Promise.resolve([]),
  ]);

  return {
    ly: productRevenueMap(previousRows),
    l2y: productRevenueMap(lastTwoRows),
  };
}

export async function getSchoolAnalytics(filters: {
  academicYear?: string;
  level?: string;
  city?: string;
  isBulkBuying?: boolean | null;
}, branchScope?: DashboardBranchScope) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null || filters.city) {
    if (scope !== null && !scope.length) return [];
    const [transactions, schools, branches] = await Promise.all([
      fetchAll<AnalyticsTransaction>(
        "t_revenue_txn",
        "payment_date,month,academic_year,agent_id,branch_id,product_id,npsn,invoice,revenue,is_newtxn,is_bulkbuying",
        branchQuery(scope),
        { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
      ),
      fetchAll<AnalyticsSchool>("t_master_school", "npsn,name,city,province,level", {}, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }),
      fetchAll<AnalyticsBranch>("t_branch", "branch_id,branch_name,region_id", branchQuery(scope), { next: { revalidate: 30, tags: ["revenue-dashboard"] } }),
    ]);
    const schoolByNpsn = new Map(schools.map((row) => [row.npsn, row]));
    const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
    const grouped = new Map<string, {
      school: string;
      city: string;
      revenue: number;
      transactions: number;
      invoices: Set<string>;
      branches: Map<number, { branch: string; revenue: number; transactions: number }>;
    }>();
    for (const row of transactions) {
      if (!row.npsn || (filters.academicYear && row.academic_year !== filters.academicYear) ||
        (filters.isBulkBuying !== null && filters.isBulkBuying !== undefined && row.is_bulkbuying !== filters.isBulkBuying) ||
        !dateMatches(row)) continue;
      const school = schoolByNpsn.get(row.npsn);
      if (filters.level && school?.level !== filters.level) continue;
      if (filters.city && school?.city?.trim() !== filters.city) continue;
      const current = grouped.get(row.npsn) ?? {
        school: school?.name ?? "School not found",
        city: school?.city ?? "-",
        revenue: 0,
        transactions: 0,
        invoices: new Set<string>(),
        branches: new Map<number, { branch: string; revenue: number; transactions: number }>(),
      };
      const branchId = row.branch_id ?? -1;
      const branch = current.branches.get(branchId) ?? {
        branch: row.branch_id === null ? "(empty)" : branchById.get(row.branch_id) ?? `Branch #${row.branch_id}`,
        revenue: 0,
        transactions: 0,
      };
      const revenue = parseRevenue(row.revenue);
      current.revenue += revenue;
      current.transactions += 1;
      if (row.invoice) current.invoices.add(row.invoice);
      branch.revenue += revenue;
      branch.transactions += 1;
      current.branches.set(branchId, branch);
      grouped.set(row.npsn, current);
    }
    return Array.from(grouped.entries())
      .map(([npsn, row]) => ({
        npsn,
        school: row.school,
        city: row.city,
        revenue: row.revenue,
        transactions: row.transactions,
        invoices: row.invoices.size,
        branches: Array.from(row.branches.values()).sort((a, b) => b.revenue - a.revenue || a.branch.localeCompare(b.branch)),
      }))
      .filter((row) => row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || a.school.localeCompare(b.school));
  }
  const rows = await readRpc<SchoolAnalyticsRow[]>("get_school_accounts", {
    p_academic_year: filters.academicYear || null,
    p_level: filters.level || null,
    p_is_bulkbuying: filters.isBulkBuying ?? null,
  });
  return rows.map((row) => ({
    npsn: row.npsn,
    school: row.school,
    city: row.city ?? "-",
    revenue: Number(row.revenue),
    transactions: Number(row.transactions),
    invoices: Number(row.invoices),
    branches: row.branches.map((branch) => ({
      branch: branch.branch,
      revenue: Number(branch.revenue),
      transactions: Number(branch.transactions),
    })),
  }));
}

/** Return distinct school cities, with East Java options listed first. */
export async function getSchoolCityOptions(): Promise<SchoolCityOption[]> {
  const rows = await fetchAll<Pick<AnalyticsSchool, "city" | "province">>(
    "t_master_school",
    "city,province",
    {},
    { next: { revalidate: 300, tags: ["revenue-dashboard"] } },
  );
  const byCity = new Map<string, SchoolCityOption>();
  for (const row of rows) {
    const city = row.city?.trim();
    if (!city) continue;
    const current = byCity.get(city);
    if (!current || (row.province === "Jawa Timur" && current.province !== "Jawa Timur")) {
      byCity.set(city, { city, province: row.province });
    }
  }
  return Array.from(byCity.values()).sort((left, right) => {
    const leftPriority = left.province === "Jawa Timur" ? 0 : 1;
    const rightPriority = right.province === "Jawa Timur" ? 0 : 1;
    return leftPriority - rightPriority || left.city.localeCompare(right.city);
  });
}

export async function getLatestRetailTransactions(
  branchScope?: DashboardBranchScope,
  search = "",
): Promise<LatestRetailTransaction[]> {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return [];
  const branchQueryParams: Record<string, string> = scope === null ? {} : { branch_id: `in.(${scope.join(",")})` };
  const transactionParams = new URLSearchParams({
    select: "id,payment_date,month,academic_year,agent_id,branch_id,product_id,npsn,invoice,revenue,is_newtxn,is_bulkbuying",
    is_bulkbuying: "eq.false",
    order: "payment_date.desc,id.desc",
    limit: "100",
    ...branchQueryParams,
  });
  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    const agentSearchParams = new URLSearchParams({
      select: "agent_id",
      agent_name: `ilike.*${normalizedSearch.replace(/[*,()]/g, " ")}*`,
      limit: "1000",
    });
    const agentSearchResponse = await supabaseRestFetch(`t_agent?${agentSearchParams.toString()}`, {
      next: { revalidate: 30, tags: ["revenue-dashboard"] },
    });
    if (!agentSearchResponse.ok) throw new Error(`t_agent: ${await agentSearchResponse.text()}`);
    const matchingAgentIds = ((await agentSearchResponse.json()) as { agent_id: number }[])
      .map((row) => Number(row.agent_id))
      .filter((id) => Number.isSafeInteger(id));
    const escaped = normalizedSearch.replace(/[,*()]/g, " ");
    const orFilters = [`invoice.ilike.*${escaped}*`];
    if (matchingAgentIds.length) orFilters.push(`agent_id.in.(${matchingAgentIds.join(",")})`);
    transactionParams.set("or", `(${orFilters.join(",")})`);
  }
  const [transactionsResponse, branches, agents, products] = await Promise.all([
    supabaseRestFetch(`t_revenue_txn?${transactionParams.toString()}`, { next: { revalidate: 30, tags: ["revenue-dashboard"] } }),
    fetchAll<AnalyticsBranch>("t_branch", "branch_id,branch_name,region_id", branchQueryParams, { next: { revalidate: 300, tags: ["revenue-dashboard"] } }),
    fetchAll<AnalyticsAgent>("t_agent", "agent_id,agent_name", {}, { next: { revalidate: 300, tags: ["revenue-dashboard"] } }),
    fetchAll<AnalyticsProduct>("t_revenue_products", "product_id,product_name,product_code", {}, { next: { revalidate: 300, tags: ["revenue-dashboard"] } }),
  ]);
  if (!transactionsResponse.ok) throw new Error(`t_revenue_txn: ${await transactionsResponse.text()}`);
  const transactions = (await transactionsResponse.json()) as AnalyticsTransaction[];
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const agentById = new Map(agents.map((row) => [row.agent_id, row.agent_name]));
  const productById = new Map(products.map((row) => [row.product_id, row.product_name || row.product_code]));
  return transactions.map((row, index) => ({
    id: row.id ?? index,
    paymentDate: row.payment_date,
    invoice: row.invoice,
    branch: row.branch_id === null ? "(empty)" : branchById.get(row.branch_id) ?? `Branch #${row.branch_id}`,
    agent: row.agent_id === null ? "(empty)" : agentById.get(row.agent_id) ?? `Agent #${row.agent_id}`,
    product: row.product_id === null ? "(empty)" : productById.get(row.product_id) ?? `Product #${row.product_id}`,
    revenue: parseRevenue(row.revenue),
  }));
}
