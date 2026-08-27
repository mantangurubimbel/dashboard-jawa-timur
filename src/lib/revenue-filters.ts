import { supabaseRpcFetch } from "@/lib/supabase-server";
import { FilterOption } from "@/lib/types";

export async function getRevenueAcademicYearOptions(): Promise<FilterOption[]> {
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
}
