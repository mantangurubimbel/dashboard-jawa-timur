import { cache } from "react";
import type { DashboardBranchScope } from "@/lib/dashboard-access";
import { supabaseRestFetch, supabaseRpcFetch } from "@/lib/supabase-server";
import { FilterOption } from "@/lib/types";

/**
 * Academic-year options are shared by multiple revenue reads on the same
 * server render (for example, the AYtD and full-year executive-summary
 * queries). React's request-scoped cache prevents duplicate RPC calls while
 * keeping the values fresh according to the fetch revalidation policy.
 */
export const getRevenueAcademicYearOptions = cache(async (): Promise<FilterOption[]> => {
  const response = await supabaseRpcFetch(
    "get_revenue_academic_year_options",
    {},
    { next: { revalidate: 60, tags: ["revenue-academic-years"] } },
  );
  if (!response.ok) {
    throw new Error(`get_revenue_academic_year_options: ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{
    id?: string;
    label?: string;
  }>;

  return rows
    .filter((row) => row.id && row.label)
    .map((row) => ({ id: row.id!, label: row.label! }));
});

export type RevenuePeriodContext = {
  academicYear: string | null;
  latestMonth: string | null;
  latestPaymentDate: string | null;
  startDate: string | null;
  months: FilterOption[];
};

const emptyRevenuePeriodContext: RevenuePeriodContext = {
  academicYear: null,
  latestMonth: null,
  latestPaymentDate: null,
  startDate: null,
  months: [],
};

function monthLabel(value: string | null | undefined) {
  return value?.match(/^([A-Za-z]+)/)?.[1] ?? value ?? "";
}

function academicYearFromMonth(value: string | null | undefined) {
  const match = value?.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const month = match[1];
  const calendarYear = Number(match[2]);
  const startYear = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].includes(month)
    ? calendarYear
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].includes(month)
      ? calendarYear - 1
      : null;

  return startYear === null
    ? null
    : `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function academicMonths(startYear: number) {
  return [
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
}

function branchScopeKey(scope: DashboardBranchScope) {
  return scope === null ? "*" : Array.from(new Set(scope)).sort((a, b) => a - b).join(",");
}

let latestRevenueContextRpcUnavailable = false;

function normalizeRevenuePeriodContext(payload: unknown): RevenuePeriodContext {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const months = Array.isArray(raw.months)
    ? raw.months
        .map((value) => {
          if (typeof value === "string") return { id: value, label: value };
          if (!value || typeof value !== "object") return null;
          const item = value as Record<string, unknown>;
          const id = typeof item.id === "string" ? item.id : "";
          const label = typeof item.label === "string" ? item.label : id;
          return id ? { id, label } : null;
        })
        .filter((value): value is FilterOption => value !== null)
    : [];

  return {
    academicYear:
      typeof raw.academicYear === "string" && raw.academicYear.trim()
        ? raw.academicYear
        : null,
    latestMonth:
      typeof raw.latestMonth === "string" && raw.latestMonth.trim()
        ? raw.latestMonth
        : null,
    latestPaymentDate:
      typeof raw.latestPaymentDate === "string" && raw.latestPaymentDate.trim()
        ? raw.latestPaymentDate
        : null,
    startDate:
      typeof raw.startDate === "string" && raw.startDate.trim()
        ? raw.startDate
        : null,
    months,
  };
}

const getLatestRevenuePeriodContextCached = cache(
  async (scopeKey: string): Promise<RevenuePeriodContext> => {
    const scope: DashboardBranchScope =
      scopeKey === "*"
        ? null
        : scopeKey
          ? scopeKey.split(",").map(Number)
          : [];

    if (!latestRevenueContextRpcUnavailable) {
      const response = await supabaseRpcFetch(
        "get_latest_revenue_context",
        { p_branch_ids: scope },
        { next: { revalidate: 30, tags: ["revenue-dashboard"] } },
      );
      if (response.ok) {
        return normalizeRevenuePeriodContext(await response.json());
      }

      const errorText = await response.text();
      if (!errorText.includes("PGRST202") && !errorText.includes("PGRST205")) {
        throw new Error(`Latest revenue context RPC failed: ${errorText}`);
      }
      latestRevenueContextRpcUnavailable = true;
    }

    // The RPC is the normal path. This fallback keeps local development
    // usable before the migration is applied and only reads the small period
    // metadata needed by the filters.
    const latestParams = new URLSearchParams({
      select: "id,payment_date,month,academic_year",
      order: "payment_date.desc,id.desc",
      limit: "1",
    });
    if (scope !== null) {
      latestParams.set(
        "branch_id",
        scope.length ? `in.(${scope.join(",")})` : "in.(-1)",
      );
    }
    const latestResponse = await supabaseRestFetch(
      `t_revenue_txn?${latestParams.toString()}`,
    );
    if (!latestResponse.ok) {
      throw new Error(`Latest revenue period request failed: ${await latestResponse.text()}`);
    }
    const latestRows = (await latestResponse.json()) as Array<{
      id?: number;
      payment_date?: string;
      month?: string;
      academic_year?: string | null;
    }>;
    const latest = latestRows[0];
    const academicYear = academicYearFromMonth(latest?.month) ?? latest?.academic_year ?? null;
    if (!latest?.payment_date || !academicYear) {
      return emptyRevenuePeriodContext;
    }

    const startMatch = academicYear.match(/^(\d{2})\/\d{2}$/);
    const startYear = startMatch ? 2000 + Number(startMatch[1]) : null;
    if (startYear === null) return emptyRevenuePeriodContext;

    const monthParams = new URLSearchParams({
      select: "month",
      month: `in.(${academicMonths(startYear).map((month) => `"${month}"`).join(",")})`,
      limit: "1000",
    });
    if (scope !== null) {
      monthParams.set(
        "branch_id",
        scope.length ? `in.(${scope.join(",")})` : "in.(-1)",
      );
    }
    const monthResponse = await supabaseRestFetch(
      `t_revenue_txn?${monthParams.toString()}`,
    );
    if (!monthResponse.ok) {
      throw new Error(`Revenue month options request failed: ${await monthResponse.text()}`);
    }
    const monthRows = (await monthResponse.json()) as Array<{ month?: string }>;
    const monthOrder = new Map(
      academicMonths(startYear).map((month, index) => [monthLabel(month), index + 1]),
    );
    const months = Array.from(
      new Set(
        monthRows
          .map((row) => monthLabel(row.month))
          .filter((month) => monthOrder.has(month)),
      ),
    )
      .sort((a, b) => (monthOrder.get(a) ?? 0) - (monthOrder.get(b) ?? 0))
      .map((month) => ({ id: month, label: month }));

    const startParams = new URLSearchParams({
      select: "payment_date",
      month: `eq.Jul ${startYear}`,
      order: "payment_date.asc,id.asc",
      limit: "1",
    });
    if (scope !== null) {
      startParams.set(
        "branch_id",
        scope.length ? `in.(${scope.join(",")})` : "in.(-1)",
      );
    }
    const startResponse = await supabaseRestFetch(
      `t_revenue_txn?${startParams.toString()}`,
    );
    if (!startResponse.ok) {
      throw new Error(`Revenue start date request failed: ${await startResponse.text()}`);
    }
    const startRows = (await startResponse.json()) as Array<{ payment_date?: string }>;

    return {
      academicYear,
      latestMonth: monthLabel(latest.month),
      latestPaymentDate: latest.payment_date,
      startDate: startRows[0]?.payment_date ?? null,
      months,
    };
  },
);

export function getLatestRevenuePeriodContext(
  branchScope: DashboardBranchScope = null,
) {
  return getLatestRevenuePeriodContextCached(branchScopeKey(branchScope));
}
