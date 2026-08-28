"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";

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
  if (error) throw new Error(`Gagal memperbarui akses user: ${error.message}`);
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
        .filter((branchId) => Number.isSafeInteger(branchId) && branchId > 0),
    ),
  );
  if (!userId || !branchIds.length) return;
  const { error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .upsert(
      branchIds.map((branchId) => ({ user_id: userId, branch_id: branchId })),
      { onConflict: "user_id,branch_id" },
    );
  if (error) throw new Error(`Gagal menambahkan branch: ${error.message}`);
  revalidatePath("/settings");
}

export async function removeDashboardBranch(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const branchIdValue = formData.get("branch_id");
  const branchId = typeof branchIdValue === "string" ? Number(branchIdValue) : NaN;
  if (!userId || !Number.isSafeInteger(branchId) || branchId <= 0) return;
  const { error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .delete()
    .eq("user_id", userId)
    .eq("branch_id", branchId);
  if (error) throw new Error(`Gagal menghapus branch: ${error.message}`);
  revalidatePath("/settings");
}
