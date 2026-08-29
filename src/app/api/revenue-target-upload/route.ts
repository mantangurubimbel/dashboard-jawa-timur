import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import {
  academicMonthNumber,
  RevenueTargetImportKind,
  transformRevenueTargetCsv,
} from "@/lib/revenue-target-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchLookup<T>(table: string, select: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from(table).select(select).limit(1000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as T[];
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "") as RevenueTargetImportKind;
    const mode = String(formData.get("mode") ?? "preview");

    if (!(file instanceof File)) {
      return Response.json({ error: "A CSV file is required." }, { status: 400 });
    }
    if (!["annual", "monthly"].includes(kind)) {
      return Response.json({ error: "Invalid target type." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return Response.json({ error: "The file must be in CSV format." }, { status: 400 });
    }

    const [branches, academicYears] = await Promise.all([
      fetchLookup<{ branch_id: number; branch_name: string }>("t_branch", "branch_id,branch_name"),
      fetchLookup<{ academic_year: string }>("t_academic_year", "academic_year"),
    ]);
    const transformed = transformRevenueTargetCsv(await file.text(), kind, {
      branches,
      academicYears,
    });

    if (transformed.report.inputRows === 0) {
      return Response.json({ error: "The CSV contains no data rows." }, { status: 400 });
    }
    if (transformed.report.invalidRows > 0) {
      return Response.json(
        { error: "Target validation failed.", report: transformed.report },
        { status: 400 },
      );
    }
    if (mode !== "commit") {
      return Response.json({
        message: "Target preview is ready to import.",
        preview: true,
        report: transformed.report,
      });
    }

    const table =
      kind === "annual"
        ? "t_revenue_annual_target"
        : "t_revenue_monthly_target";
    const onConflict =
      kind === "annual"
        ? "academic_year,branch_id"
        : "academic_year,branch_id,month_number";
    const payload = transformed.rows.map((row) =>
      kind === "annual"
        ? {
            academic_year: row.academic_year,
            branch_id: row.branch_id,
            target_revenue: row.target_revenue,
          }
        : {
            academic_year: row.academic_year,
            branch_id: row.branch_id,
            month_number: academicMonthNumber(row.month ?? ""),
            target_revenue: row.target_revenue,
          },
    );
    const supabase = createSupabaseServiceRoleClient();
    const { data: importedRows, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict, ignoreDuplicates: false })
      .select("id");
    if (error) {
      throw new Error(`Target import failed: ${error.message}`);
    }

    return Response.json({
      message: "Target import completed successfully.",
      imported: importedRows?.length ?? transformed.rows.length,
      report: transformed.report,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Target import failed." },
      { status: 500 },
    );
  }
}
