"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { DASHBOARD_EXCLUDED_BRANCH_IDS } from "@/lib/dashboard-access";

export async function toggleRevenueDashboardAccess(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const access = String(formData.get("access") ?? "") === "true";
  if (!userId) return;

  const serviceClient = createSupabaseServiceRoleClient();
  const { error } = await serviceClient
    .from("t_app_user")
    .update({ access_revenue_dashboard: access })
    .eq("id", userId);
  if (error) throw new Error(`Failed to update user access: ${error.message}`);
  revalidatePath("/settings");
}

export async function assignDashboardBranch(formData: FormData) {
  await requireAdmin();
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
  revalidatePath("/settings");
}

export async function removeDashboardBranch(formData: FormData) {
  await requireAdmin();
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
  revalidatePath("/settings");
}

export async function toggleDashboardMaintenance(formData: FormData) {
  await requireAdmin();
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
  revalidatePath("/settings");
  revalidatePath("/maintenance");
}
