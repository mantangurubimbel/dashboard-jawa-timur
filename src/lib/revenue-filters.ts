import { cache } from "react";
import { supabaseRpcFetch } from "@/lib/supabase-server";
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
