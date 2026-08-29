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
 * Context shared by the dashboard layout and data modules during one server
 * render. Keeping the session/profile lookup here avoids repeating the same
 * auth request before the page data is loaded.
 */
export type DashboardUserContext = {
  user: { id: string; email?: string | null } | null;
  profile: { name: string | null; access_revenue_dashboard: boolean | null } | null;
  isAdmin: boolean;
  hasDashboardAccess: boolean;
  branchScope: DashboardBranchScope;
};

export const getDashboardUserContext = cache(async (): Promise<DashboardUserContext> => {
  const authClient = await createSupabaseAuthServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user?.email) {
    // Dashboard routes already require authentication. If a data helper is
    // called outside that layout, fail closed instead of returning all data.
    return {
      user: null,
      profile: null,
      isAdmin: false,
      hasDashboardAccess: false,
      branchScope: [],
    };
  }

  const isAdmin = isAdminEmail(user.email);
  const { data: profile } = await createSupabaseServiceRoleClient()
    .from("t_app_user")
    .select("name,access_revenue_dashboard")
    .eq("id", user.id)
    .maybeSingle();

  if (isAdmin) {
    return {
      user: { id: user.id, email: user.email },
      profile,
      isAdmin,
      hasDashboardAccess: true,
      branchScope: null,
    };
  }

  if (!profile?.access_revenue_dashboard) {
    return {
      user: { id: user.id, email: user.email },
      profile,
      isAdmin,
      hasDashboardAccess: false,
      branchScope: [],
    };
  }

  const { data, error } = await createSupabaseServiceRoleClient()
    .from("t_dashboard_user_branch")
    .select("branch_id")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to read dashboard branch access: ${error.message}`);
  }

  return {
    user: { id: user.id, email: user.email },
    profile,
    isAdmin,
    hasDashboardAccess: true,
    branchScope: Array.from(
      new Set(
        (data ?? [])
          .map((row) => Number(row.branch_id))
          .filter((branchId) => Number.isSafeInteger(branchId) && branchId > 0),
      ),
    ),
  };
});

/**
 * Resolve the branch scope once per server render. React's request-scoped
 * cache prevents every data module on a page from performing the same auth,
 * profile, and assignment lookups.
 */
export const getDashboardBranchScope = cache(async (): Promise<DashboardBranchScope> => {
  const context = await getDashboardUserContext();
  return context.branchScope;
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
