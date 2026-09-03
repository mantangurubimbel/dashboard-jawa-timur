import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { RevenueLookup } from "@/lib/revenue-transform";

export async function fetchRevenueLookup(): Promise<RevenueLookup> {
  const supabase = createSupabaseServiceRoleClient();

  async function fetchAll<T>(table: string, columns: string) {
    const rows: T[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(`${table}: ${error.message}`);
      }

      const page = data as T[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  const [grades, products, agents, branches, academicYears, schools] = await Promise.all([
    fetchAll<{ grade_id: number; grade: string }>("t_grade", "grade_id,grade").catch(
      (error) => {
        throw new Error(`Lookup t_grade failed: ${error instanceof Error ? error.message : error}`);
      },
    ),
    fetchAll<{ product_id: number; product_code: string }>(
      "t_revenue_products",
      "product_id,product_code",
    ).catch((error) => {
      throw new Error(
        `Lookup t_revenue_products failed: ${error instanceof Error ? error.message : error}`,
      );
    }),
    fetchAll<{ agent_id: number; agent_name: string; agent_email: string | null }>(
      "t_agent",
      "agent_id,agent_name,agent_email",
    ).catch((error) => {
      throw new Error(`Lookup t_agent failed: ${error instanceof Error ? error.message : error}`);
    }),
    fetchAll<{ branch_id: number; branch_name: string }>("t_branch", "branch_id,branch_name").catch(
      (error) => {
        throw new Error(`Lookup t_branch failed: ${error instanceof Error ? error.message : error}`);
      },
    ),
    fetchAll<{ academic_year: string }>("t_academic_year", "academic_year").catch((error) => {
      throw new Error(
        `Lookup t_academic_year failed: ${error instanceof Error ? error.message : error}`,
      );
    }),
    fetchAll<{ npsn: string }>("t_master_school", "npsn").catch((error) => {
      throw new Error(
        `Lookup t_master_school failed: ${error instanceof Error ? error.message : error}`,
      );
    }),
  ]);

  return { grades, products, agents, branches, academicYears, schools };
}
