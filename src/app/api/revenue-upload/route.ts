import { transformRevenueCsv } from "@/lib/revenue-transform";
import {
  createSupabaseServiceRoleClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function fetchLookup() {
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
      if (page.length < pageSize) {
        return rows;
      }
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

  return {
    grades,
    products,
    agents,
    branches,
    academicYears,
    schools,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const startDate = String(formData.get("startDate") ?? "").trim();
    const mode = String(formData.get("mode") ?? "preview").trim();

    if (!(file instanceof File)) {
      return Response.json({ error: "A CSV file is required." }, { status: 400 });
    }

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return Response.json({ error: "A valid start date is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return Response.json({ error: "The file must be in CSV format." }, { status: 400 });
    }

    const lookup = await fetchLookup();
    const csvText = await file.text();
    const transformed = transformRevenueCsv(csvText, startDate, lookup);

    if (!transformed.report.inputRows) {
      return Response.json({ error: "The CSV contains no data rows." }, { status: 400 });
    }

    if (!transformed.rows.length) {
      return Response.json({
        message: "No data matches the date filter.",
        report: transformed.report,
      });
    }

    const replacementDates = Array.from(
      new Set(transformed.rows.map((row) => row.payment_date)),
    ).sort();

    if (mode !== "commit") {
      const supabase = createSupabaseServiceRoleClient();
      const { count, error } = await supabase
        .from("t_revenue_txn")
        .select("id", { count: "exact", head: true })
        .in("payment_date", replacementDates);

      if (error) {
        throw new Error(`Existing data preview failed: ${error.message}`);
      }

      return Response.json({
        message: "Replace preview is ready for confirmation.",
        preview: true,
        existingRows: count ?? 0,
        replacementDates,
        report: transformed.report,
      });
    }

    const supabase = createSupabaseServiceRoleClient();
    // Keep each RPC payload small enough for Supabase's statement timeout.
    // Never split one payment date across batches: the replace RPC deletes
    // existing rows for every date in its payload before inserting the rows.
    const rowsByDate = new Map<string, typeof transformed.rows>();
    for (const row of transformed.rows) {
      const rows = rowsByDate.get(row.payment_date) ?? [];
      rows.push(row);
      rowsByDate.set(row.payment_date, rows);
    }
    const batches: typeof transformed.rows[] = [];
    let currentBatch: typeof transformed.rows = [];
    for (const dateRows of rowsByDate.values()) {
      if (currentBatch.length && currentBatch.length + dateRows.length > 1000) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      currentBatch.push(...dateRows);
    }
    if (currentBatch.length) batches.push(currentBatch);

    let inserted = 0;
    let deleted = 0;
    for (const [index, batch] of batches.entries()) {
      const { data: replacementResult, error: replaceError } = await supabase.rpc(
        "replace_revenue_txn_by_dates",
        { p_rows: batch },
      );
      if (replaceError) {
        throw new Error(`Replace failed on batch ${index + 1}/${batches.length}: ${replaceError.message}`);
      }
      inserted += Number(replacementResult?.inserted_rows ?? batch.length);
      deleted += Number(replacementResult?.deleted_rows ?? 0);
    }

    return Response.json({
      message: "Replace and import completed successfully.",
      inserted,
      deleted,
      replacedDates: replacementDates.length,
      replacementDates,
      report: transformed.report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed to process.";
    return Response.json({ error: message }, { status: 500 });
  }
}
