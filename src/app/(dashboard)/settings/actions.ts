"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { DASHBOARD_EXCLUDED_BRANCH_IDS } from "@/lib/dashboard-access";
import { recordAdminAuditLog } from "@/lib/admin-audit";

export async function toggleRevenueDashboardAccess(formData: FormData) {
  const { user } = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const access = String(formData.get("access") ?? "") === "true";
  if (!userId) return;

  const serviceClient = createSupabaseServiceRoleClient();
  const { error } = await serviceClient
    .from("t_app_user")
    .update({ access_revenue_dashboard: access })
    .eq("id", userId);
  if (error) throw new Error(`Failed to update user access: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "toggle_dashboard_access", targetType: "user", targetId: userId, metadata: { access } });
  revalidatePath("/settings");
}

export async function assignDashboardBranch(formData: FormData) {
  const { user } = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const branchIds = Array.from(
    new Set(
      formData
        .getAll("branch_id")
        .map((value) => typeof value === "string" ? Number(value) : NaN)
        .filter(
          (branchId) =>
            Number.isSafeInteger(branchId) &&
            branchId > 0 &&
            !DASHBOARD_EXCLUDED_BRANCH_IDS.includes(branchId as (typeof DASHBOARD_EXCLUDED_BRANCH_IDS)[number]),
        ),
    ),
  );
  if (!userId || !branchIds.length) return;
  const { error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .upsert(
      branchIds.map((branchId) => ({ user_id: userId, branch_id: branchId })),
      { onConflict: "user_id,branch_id" },
    );
  if (error) throw new Error(`Failed to add branch: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "assign_dashboard_branch", targetType: "user", targetId: userId, metadata: { branchIds } });
  revalidatePath("/settings");
}

export async function removeDashboardBranch(formData: FormData) {
  const { user } = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const branchIdValue = formData.get("branch_id");
  const branchId = typeof branchIdValue === "string" ? Number(branchIdValue) : NaN;
  if (
    !userId ||
    !Number.isSafeInteger(branchId) ||
    branchId <= 0 ||
    DASHBOARD_EXCLUDED_BRANCH_IDS.includes(branchId as (typeof DASHBOARD_EXCLUDED_BRANCH_IDS)[number])
  ) return;
  const { error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .delete()
    .eq("user_id", userId)
    .eq("branch_id", branchId);
  if (error) throw new Error(`Failed to remove branch: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "remove_dashboard_branch", targetType: "user", targetId: userId, metadata: { branchId } });
  revalidatePath("/settings");
}

export async function toggleDashboardMaintenance(formData: FormData) {
  const { user } = await requireAdmin();
  const isActive = String(formData.get("is_active") ?? "") === "true";
  const message = String(formData.get("message") ?? "").trim();
  const { error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_maintenance")
    .upsert(
      {
        id: 1,
        is_active: isActive,
        ...(message ? { message } : {}),
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(`Failed to update maintenance mode: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "toggle_maintenance", targetType: "maintenance", targetId: "1", metadata: { isActive } });
  revalidatePath("/settings");
  revalidatePath("/maintenance");
}

const targetTables = {
  annual: "t_revenue_annual_target",
  monthly: "t_revenue_monthly_target",
  agent_weekly: "t_agent_weekly_target",
  branch_weekly: "t_branch_weekly_target",
} as const;

type TargetKind = keyof typeof targetTables;

function targetTable(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as TargetKind;
  return kind in targetTables ? targetTables[kind] : null;
}

function targetId(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  return /^\d+$/.test(id) ? id : null;
}

function targetAmount(formData: FormData) {
  const value = Number(String(formData.get("target_revenue") ?? ""));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function updateRevenueTarget(formData: FormData) {
  const { user } = await requireAdmin();
  const table = targetTable(formData);
  const id = targetId(formData);
  const targetRevenue = targetAmount(formData);
  if (!table || !id || targetRevenue === null) throw new Error("Target revenue must be a non-negative integer.");

  const { error } = await createSupabaseServiceRoleClient()
    .from(table)
    .update({ target_revenue: targetRevenue })
    .eq("id", id);
  if (error) throw new Error(`Failed to update target: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "update_revenue_target", targetType: table, targetId: id, metadata: { targetRevenue } });

  revalidatePath("/settings");
  revalidatePath("/revenue");
  revalidatePath("/all-time-performance/agent");
  revalidatePath("/all-time-performance/branch");
}

export async function deleteRevenueTarget(formData: FormData) {
  const { user } = await requireAdmin();
  const table = targetTable(formData);
  const id = targetId(formData);
  if (!table || !id) throw new Error("Invalid target record.");

  const { error } = await createSupabaseServiceRoleClient()
    .from(table)
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete target: ${error.message}`);
  await recordAdminAuditLog({ actorUserId: user.id, actorEmail: user.email!, action: "delete_revenue_target", targetType: table, targetId: id });

  revalidatePath("/settings");
  revalidatePath("/revenue");
  revalidatePath("/all-time-performance/agent");
  revalidatePath("/all-time-performance/branch");
}
