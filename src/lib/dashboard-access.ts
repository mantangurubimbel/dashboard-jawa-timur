import { cache } from "react";
import { isAdminEmail } from "@/lib/admin-auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";

/**
 * `null` means unrestricted access (admin). An array contains the only
 * branch IDs a non-admin user may access. An empty array intentionally means
 * that the user has no dashboard data access until an admin assigns a branch.
 */
export type DashboardBranchScope = number[] | null;

/**
 * Resolve the branch scope once per server render. React's request-scoped
 * cache prevents every data module on a page from performing the same auth
 * and assignment lookup.
 */
export const getDashboardBranchScope = cache(async (): Promise<DashboardBranchScope> => {
  const authClient = await createSupabaseAuthServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user?.email) {
    // Dashboard routes already require authentication. If a data helper is
    // called outside that layout, fail closed instead of returning all data.
    return [];
  }

  if (isAdminEmail(user.email)) return null;

  const { data, error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .select("branch_id")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Gagal membaca akses branch dashboard: ${error.message}`);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => Number(row.branch_id))
        .filter((branchId) => Number.isSafeInteger(branchId) && branchId > 0),
    ),
  );
});

export function isBranchInScope(
  scope: DashboardBranchScope,
  branchId: number | null | undefined,
) {
  return scope === null || (branchId !== null && branchId !== undefined && scope.includes(branchId));
}

/**
 * Sanitize a branch selected through the URL. Invalid/unassigned selections
 * are ignored, while the scope itself remains enforced by every data query.
 */
export function resolveScopedBranchId(
  scope: DashboardBranchScope,
  branchId: number | undefined,
) {
  return branchId !== undefined && isBranchInScope(scope, branchId) ? branchId : undefined;
}

export function scopedBranchIds(scope: DashboardBranchScope) {
  return scope === null ? null : scope;
}
