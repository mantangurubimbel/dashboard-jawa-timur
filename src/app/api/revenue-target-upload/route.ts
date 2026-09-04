import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import {
  academicMonthNumber,
  type AgentWeeklyTargetRow,
  type BranchWeeklyTargetRow,
  type RevenueTargetRow,
  transformBranchWeeklyTargetCsv,
  transformAgentWeeklyTargetCsv,
  RevenueTargetImportKind,
  transformRevenueTargetCsv,
} from "@/lib/revenue-target-import";
import { requireAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function fetchLookup<T>(table: string, select: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from(table).select(select).limit(1000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as T[];
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdminApi())) {
      return Response.json({ error: "Only administrators can import revenue targets." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "") as RevenueTargetImportKind;
    const mode = String(formData.get("mode") ?? "preview");

    if (!(file instanceof File)) {
      return Response.json({ error: "A CSV file is required." }, { status: 400 });
    }
    if (!["annual", "weekly", "branch_weekly"].includes(kind)) {
      return Response.json({ error: "Invalid target type." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return Response.json({ error: "The file must be in CSV format." }, { status: 400 });
    }

    const [branches, academicYears, agents] = await Promise.all([
      fetchLookup<{ branch_id: number; branch_name: string }>("t_branch", "branch_id,branch_name"),
      fetchLookup<{ academic_year: string }>("t_academic_year", "academic_year"),
      kind === "weekly"
        ? fetchLookup<{ agent_id: number; agent_name: string; agent_email: string | null }>(
            "t_agent",
            "agent_id,agent_name,agent_email",
          )
        : Promise.resolve([] as { agent_id: number; agent_name: string; agent_email: string | null }[]),
    ]);
    const csvText = await file.text();
    const transformed = kind === "weekly"
      ? transformAgentWeeklyTargetCsv(csvText, { agents, branches, academicYears })
      : kind === "branch_weekly"
        ? transformBranchWeeklyTargetCsv(csvText, { branches, academicYears })
        : transformRevenueTargetCsv(csvText, kind, { branches, academicYears });

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

    const supabase = createSupabaseServiceRoleClient();
    if (kind === "weekly") {
      const payload = (transformed.rows as AgentWeeklyTargetRow[]).map((row) => ({
        agent_id: row.agent_id,
        academic_year: row.academic_year,
        month: row.month,
        week_start: row.week_start,
        branch_id: row.branch_id,
        target_revenue: row.target_revenue,
      }));
      const { data: importedRows, error } = await supabase
        .from("t_agent_weekly_target")
        .upsert(payload, { onConflict: "agent_id,week_start", ignoreDuplicates: false })
        .select("id");
      if (error) throw new Error(`Target import failed: ${error.message}`);
      return Response.json({
        message: "Weekly agent target import completed successfully.",
        imported: importedRows?.length ?? payload.length,
        report: transformed.report,
      });
    }

    if (kind === "branch_weekly") {
      const payload = (transformed.rows as BranchWeeklyTargetRow[]).map((row) => ({
        academic_year: row.academic_year,
        month: row.month,
        week_start: row.week_start,
        branch_id: row.branch_id,
        target_revenue: row.target_revenue,
      }));
      const { data: importedRows, error } = await supabase
        .from("t_branch_weekly_target")
        .upsert(payload, { onConflict: "branch_id,week_start", ignoreDuplicates: false })
        .select("id");
      if (error) throw new Error(`Target import failed: ${error.message}`);
      return Response.json({
        message: "Weekly branch target import completed successfully.",
        imported: importedRows?.length ?? payload.length,
        report: transformed.report,
      });
    }

    const table = kind === "annual" ? "t_revenue_annual_target" : "t_revenue_monthly_target";
    const onConflict = kind === "annual"
      ? "academic_year,branch_id"
      : "academic_year,branch_id,month_number";
    const revenueRows = transformed.rows as RevenueTargetRow[];
    const payload = kind === "annual"
      ? revenueRows.map((row) => ({
          academic_year: row.academic_year,
          branch_id: row.branch_id,
          target_revenue: row.target_revenue,
        }))
      : revenueRows.map((row) => ({
          academic_year: row.academic_year,
          branch_id: row.branch_id,
          month_number: academicMonthNumber(row.month ?? ""),
          target_revenue: row.target_revenue,
        }));
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
