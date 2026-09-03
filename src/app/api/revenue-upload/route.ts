import { transformRevenueCsv } from "@/lib/revenue-transform";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { fetchRevenueLookup } from "@/lib/revenue-upload";
import { requireAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    if (!(await requireAdminApi())) {
      return Response.json({ error: "Only administrators can upload revenue data." }, { status: 403 });
    }

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

    const lookup = await fetchRevenueLookup();
    const csvText = await file.text();
    const transformed = transformRevenueCsv(csvText, startDate, lookup);

    if (!transformed.report.inputRows) {
      return Response.json({ error: "The CSV contains no data rows." }, { status: 400 });
    }

    if (!transformed.rows.length && !transformed.invalidRows.length) {
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
      let existingRows = 0;
      if (replacementDates.length) {
        const { count, error } = await supabase
          .from("t_revenue_txn")
          .select("id", { count: "exact", head: true })
          .in("payment_date", replacementDates);

        if (error) {
          throw new Error(`Existing data preview failed: ${error.message}`);
        }
        existingRows = count ?? 0;
      }

      return Response.json({
        message: "Replace preview is ready for confirmation.",
        preview: true,
        existingRows,
        replacementDates,
        failedRows: transformed.invalidRows,
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

    let failedRows: Array<{
      id: number;
      batchId: string;
      rowNumber: number;
      raw: Record<string, string>;
      missingFields: string[];
    }> = [];
    if (transformed.invalidRows.length) {
      const batchId = crypto.randomUUID();
      const { data: issueRows, error: issueError } = await supabase
        .from("t_revenue_upload_issue")
        .insert(
          transformed.invalidRows.map((issue) => ({
            batch_id: batchId,
            source_row: issue.rowNumber,
            start_date: startDate,
            raw_row: issue.raw,
            missing_fields: issue.missingFields,
          })),
        )
        .select("id,batch_id,source_row,raw_row,missing_fields");
      if (issueError) {
        throw new Error(`Failed to save incomplete rows: ${issueError.message}`);
      }
      failedRows = (issueRows ?? []).map((issue) => ({
        id: issue.id as number,
        batchId: issue.batch_id as string,
        rowNumber: issue.source_row as number,
        raw: issue.raw_row as Record<string, string>,
        missingFields: (issue.missing_fields as string[]) ?? [],
      }));
    }

    return Response.json({
      message: transformed.invalidRows.length
        ? "Valid rows were imported. Incomplete rows are ready for completion."
        : "Replace and import completed successfully.",
      inserted,
      deleted,
      replacedDates: replacementDates.length,
      replacementDates,
      failedRows,
      report: transformed.report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed to process.";
    return Response.json({ error: message }, { status: 500 });
  }
}
