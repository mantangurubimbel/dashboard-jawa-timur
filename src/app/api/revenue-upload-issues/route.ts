import { fetchRevenueLookup } from "@/lib/revenue-upload";
import { transformRevenueRows, type RevenueRawRow } from "@/lib/revenue-transform";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type IssueRow = {
  id: number;
  batch_id: string;
  source_row: number;
  start_date: string;
  raw_row: RevenueRawRow;
  missing_fields: string[];
  status: "pending" | "uploaded" | "failed";
  error_message: string | null;
};

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text.toLowerCase() === "null" ? "" : text;
}

function toClientIssue(row: IssueRow) {
  return {
    id: row.id,
    batchId: row.batch_id,
    rowNumber: row.source_row,
    raw: row.raw_row,
    missingFields: row.missing_fields ?? [],
    error: row.error_message,
  };
}

export async function GET() {
  try {
    if (!(await requireAdminApi())) {
      return Response.json({ error: "Only administrators can view incomplete rows." }, { status: 403 });
    }

    const { data, error } = await createSupabaseServiceRoleClient()
      .from("t_revenue_upload_issue")
      .select("id,batch_id,source_row,start_date,raw_row,missing_fields,status,error_message")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`Failed to load incomplete rows: ${error.message}`);

    return Response.json({ issues: (data as IssueRow[]).map(toClientIssue) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load incomplete rows." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let issueId = 0;
  try {
    if (!(await requireAdminApi())) {
      return Response.json({ error: "Only administrators can complete revenue rows." }, { status: 403 });
    }

    const body = (await request.json()) as {
      id?: number;
      agentName?: string;
      agentEmail?: string;
      cluster?: string;
    };
    issueId = Number(body.id);
    if (!Number.isSafeInteger(issueId) || issueId <= 0) {
      return Response.json({ error: "A valid incomplete-row ID is required." }, { status: 400 });
    }

    const agentName = clean(body.agentName);
    const agentEmail = clean(body.agentEmail);
    const cluster = clean(body.cluster);
    const missingFields = [
      ["Agent Name", agentName],
      ["Agent Email", agentEmail],
      ["Cluster", cluster],
    ].filter(([, value]) => !value).map(([field]) => field);
    if (missingFields.length) {
      return Response.json(
        { error: `Complete the required fields: ${missingFields.join(", ")}.`, missingFields },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServiceRoleClient();
    const { data: issue, error: issueError } = await supabase
      .from("t_revenue_upload_issue")
      .select("id,batch_id,source_row,start_date,raw_row,missing_fields,status,error_message")
      .eq("id", issueId)
      .eq("status", "pending")
      .maybeSingle();
    if (issueError) throw new Error(`Failed to load incomplete row: ${issueError.message}`);
    if (!issue) return Response.json({ error: "This row is no longer pending." }, { status: 404 });

    const raw = {
      ...((issue as IssueRow).raw_row ?? {}),
      "Agent Name": agentName,
      "Agent Email": agentEmail,
      Cluster: cluster,
    } satisfies RevenueRawRow;
    const transformed = transformRevenueRows([raw], (issue as IssueRow).start_date, await fetchRevenueLookup());
    if (transformed.invalidRows.length || !transformed.rows.length) {
      return Response.json(
        { error: "The completed row is outside the selected date range or still incomplete." },
        { status: 400 },
      );
    }

    const row = transformed.rows[0];
    if (row.agent_id === null) {
      return Response.json(
        { error: "Agent Email and Agent Name do not map to one agent in master data." },
        { status: 400 },
      );
    }
    if (row.branch_id === null) {
      return Response.json({ error: "Cluster does not match a branch in master data." }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("t_revenue_txn").insert(row);
    if (insertError) throw new Error(`Failed to upload completed row: ${insertError.message}`);

    const { error: updateError } = await supabase
      .from("t_revenue_upload_issue")
      .update({ status: "uploaded", missing_fields: [], error_message: null, resolved_at: new Date().toISOString() })
      .eq("id", issueId)
      .eq("status", "pending");
    if (updateError) throw new Error(`Row uploaded but status update failed: ${updateError.message}`);

    return Response.json({ message: "Completed row uploaded successfully.", id: issueId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload completed row.";
    if (issueId) {
      try {
        await createSupabaseServiceRoleClient()
          .from("t_revenue_upload_issue")
          .update({ error_message: message })
          .eq("id", issueId)
          .eq("status", "pending");
      } catch {
        // Keep the original upload error as the response.
      }
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
