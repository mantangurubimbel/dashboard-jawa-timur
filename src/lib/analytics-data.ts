import { supabaseRpcFetch } from "@/lib/supabase-server";

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

async function readRpc<T>(functionName: string, body: Record<string, unknown> = {}) {
  const response = await supabaseRpcFetch(functionName, body);
  if (!response.ok) {
    throw new Error(`${functionName}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function getAgentAnalytics(filters: {
  academicYear?: string;
  branchId?: number;
  fromDate?: string;
  toDate?: string;
}) {
  const rows = await readRpc<AgentAnalyticsRow[]>("get_agent_performance", {
    p_academic_year: filters.academicYear || null,
    p_branch_id: filters.branchId ?? null,
    p_from_date: filters.fromDate || null,
    p_to_date: filters.toDate || null,
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
}

export async function getProductAnalytics(filters: {
  academicYear?: string;
  branchId?: number;
  fromDate?: string;
  toDate?: string;
} = {}) {
  const rows = await readRpc<ProductAnalyticsRow[]>("get_product_sales", {
    p_academic_year: filters.academicYear || null,
    p_branch_id: filters.branchId ?? null,
    p_from_date: filters.fromDate || null,
    p_to_date: filters.toDate || null,
  });
  return rows.map((row) => ({
    product: row.product,
    revenue: Number(row.revenue),
    transactions: Number(row.transactions),
    invoices: Number(row.invoices),
    bulkBuying: Boolean(row.bulkBuying),
  }));
}

export async function getSchoolAnalytics(filters: {
  academicYear?: string;
  level?: string;
  isBulkBuying?: boolean | null;
}) {
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
