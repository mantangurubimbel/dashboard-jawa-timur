import { Settings2 } from "lucide-react";
import { ImportRevenueTargetButton } from "@/components/import-revenue-target-button";
import { UploadRawDataButton } from "@/components/upload-raw-data-button";
import { supabaseRestFetch } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminUserTable } from "@/components/admin-user-table";
import { DASHBOARD_EXCLUDED_BRANCH_IDS } from "@/lib/dashboard-access";
import { toggleDashboardMaintenance } from "@/app/(dashboard)/settings/actions";
import { FormPendingIndicator, PendingSubmitButton } from "@/components/form-submit-controls";

export const dynamic = "force-dynamic";

async function fetchCount(table: string, query = "") {
  const response = await supabaseRestFetch(`${table}?select=*&limit=1${query}`);
  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  return range ? Number(range.split("/")[1]) || 0 : 0;
}

export default async function SettingsPage() {
  await requireAdmin();
  const [users, branches, roles, userRows, positionRows, userBranchRows, branchRows, maintenanceRows] = await Promise.all([
    fetchCount("t_app_user"),
    fetchCount("t_branch", `&branch_id=not.in.(${DASHBOARD_EXCLUDED_BRANCH_IDS.join(",")})`),
    fetchCount("t_role"),
    supabaseRestFetch("t_app_user?select=id,name,email,position_id,access_revenue_dashboard&user_grade=gte.2&order=name&limit=1000"),
    supabaseRestFetch("t_position?select=position_id,position_name&limit=1000"),
    supabaseRestFetch(`t_dashboard_user_branch?select=user_id,branch_id&branch_id=not.in.(${DASHBOARD_EXCLUDED_BRANCH_IDS.join(",")})&limit=5000`),
    supabaseRestFetch(`t_branch?select=branch_id,branch_name&branch_id=not.in.(${DASHBOARD_EXCLUDED_BRANCH_IDS.join(",")})&order=branch_name&limit=1000`),
    supabaseRestFetch("t_dashboard_maintenance?select=is_active,message&id=eq.1&limit=1"),
  ]);
  const maintenance = maintenanceRows.ok
    ? ((await maintenanceRows.json()) as { is_active?: boolean; message?: string }[])[0]
    : undefined;
  const profiles = userRows.ok ? await userRows.json() as { id: string; name?: string; email?: string; position_id?: number; access_revenue_dashboard?: boolean }[] : [];
  const positionsMap = positionRows.ok ? new Map((await positionRows.json() as { position_id: number; position_name: string }[]).map((row) => [row.position_id, row.position_name])) : new Map<number, string>();
  const branchesMap = branchRows.ok ? new Map((await branchRows.json() as { branch_id: number; branch_name: string }[]).map((row) => [row.branch_id, row.branch_name])) : new Map<number, string>();
  const branchesByUser = new Map<string, { id: number; name: string }[]>();
  if (userBranchRows.ok) for (const row of await userBranchRows.json() as { user_id: string; branch_id: number }[]) { const list = branchesByUser.get(row.user_id) ?? []; const name = branchesMap.get(row.branch_id); if (name) list.push({ id: row.branch_id, name }); branchesByUser.set(row.user_id, list); }
  const adminUsers = profiles.map((profile) => ({ id: profile.id, name: profile.name ?? "", email: profile.email ?? "", position: positionsMap.get(profile.position_id ?? -1) ?? "", branches: branchesByUser.get(profile.id) ?? [], accessRevenue: Boolean(profile.access_revenue_dashboard) }));

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Settings</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Settings</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Manage users, access permissions, and revenue data processes.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[["User", users], ["Branch", branches], ["Role", roles]].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Website Maintenance</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Temporarily disable dashboard access for non-admin users while maintenance is in progress.
                Admin emails can still sign in and use the dashboard.
              </p>
            </div>
            <form action={toggleDashboardMaintenance} className="flex shrink-0 items-center gap-3">
              <input name="is_active" type="hidden" value={String(!Boolean(maintenance?.is_active))} />
              <input
                name="message"
                type="hidden"
                value={maintenance?.message ?? "This website is currently under maintenance. Please check back later."}
              />
              <span className={`text-xs font-semibold ${maintenance?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                {maintenance?.is_active ? "Enabled" : "Disabled"}
              </span>
              <PendingSubmitButton
                aria-label={maintenance?.is_active ? "Disable website maintenance" : "Enable website maintenance"}
                aria-pressed={Boolean(maintenance?.is_active)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-70 ${maintenance?.is_active ? "bg-amber-600" : "bg-slate-300"}`}
                title={maintenance?.is_active ? "Disable website maintenance" : "Enable website maintenance"}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${maintenance?.is_active ? "translate-x-5" : "translate-x-0"}`}>
                  <FormPendingIndicator className="h-3 w-3 text-teal-700" />
                </span>
              </PendingSubmitButton>
              <FormPendingIndicator />
            </form>
          </div>
          <form action={toggleDashboardMaintenance} className="mt-4 grid gap-2">
            <input name="is_active" type="hidden" value={String(Boolean(maintenance?.is_active))} />
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600" htmlFor="maintenance-message">
              Maintenance message
              <textarea
                id="maintenance-message"
                name="message"
                defaultValue={maintenance?.message ?? "This website is currently under maintenance. Please check back later."}
                rows={2}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <div className="flex items-center gap-2">
              <PendingSubmitButton className="inline-flex h-8 items-center justify-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                Save message
              </PendingSubmitButton>
              <FormPendingIndicator />
            </div>
          </form>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Revenue Data</h2>
          <p className="mt-1 text-sm text-slate-500">Upload raw transactions and manage branch and agent targets.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <UploadRawDataButton />
            <ImportRevenueTargetButton />
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">User & Access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Manage each user&apos;s Revenue Dashboard and branch access using the table below.
          </p>
        </div>
      </section>
      <AdminUserTable
        users={adminUsers}
        branchOptions={Array.from(branchesMap, ([id, name]) => ({ id, name }))}
      />
    </div>
  );
}
