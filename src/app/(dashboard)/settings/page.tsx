import { Settings2 } from "lucide-react";
import { ImportRevenueTargetButton } from "@/components/import-revenue-target-button";
import { UploadRawDataButton } from "@/components/upload-raw-data-button";
import { supabaseRestFetch } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { AdminUserTable } from "@/components/admin-user-table";

export const dynamic = "force-dynamic";

async function fetchCount(table: string) {
  const response = await supabaseRestFetch(`${table}?select=*&limit=1`);
  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  return range ? Number(range.split("/")[1]) || 0 : 0;
}

export default async function SettingsPage() {
  await requireAdmin();
  const [users, branches, roles, userRows, roleRows, positionRows, userBranchRows, branchRows] = await Promise.all([
    fetchCount("t_app_user"),
    fetchCount("t_branch"),
    fetchCount("t_role"),
    supabaseRestFetch("t_app_user?select=id,name,role_id,position_id,access_revenue_dashboard&user_grade=gte.2&order=name&limit=1000"),
    supabaseRestFetch("t_role?select=role_id,role_name&limit=1000"),
    supabaseRestFetch("t_position?select=position_id,position_name&limit=1000"),
    supabaseRestFetch("t_dashboard_user_branch?select=user_id,branch_id&limit=5000"),
    supabaseRestFetch("t_branch?select=branch_id,branch_name&order=branch_name&limit=1000"),
  ]);
  const profiles = userRows.ok ? await userRows.json() as { id: string; name?: string; role_id?: number; position_id?: number; access_revenue_dashboard?: boolean }[] : [];
  const rolesMap = roleRows.ok ? new Map((await roleRows.json() as { role_id: number; role_name: string }[]).map((row) => [row.role_id, row.role_name])) : new Map<number, string>();
  const positionsMap = positionRows.ok ? new Map((await positionRows.json() as { position_id: number; position_name: string }[]).map((row) => [row.position_id, row.position_name])) : new Map<number, string>();
  const branchesMap = branchRows.ok ? new Map((await branchRows.json() as { branch_id: number; branch_name: string }[]).map((row) => [row.branch_id, row.branch_name])) : new Map<number, string>();
  const branchesByUser = new Map<string, { id: number; name: string }[]>();
  if (userBranchRows.ok) for (const row of await userBranchRows.json() as { user_id: string; branch_id: number }[]) { const list = branchesByUser.get(row.user_id) ?? []; const name = branchesMap.get(row.branch_id); if (name) list.push({ id: row.branch_id, name }); branchesByUser.set(row.user_id, list); }
  const authUsers = await createSupabaseServiceRoleClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user.email ?? ""]));
  const adminUsers = profiles.map((profile) => ({ id: profile.id, name: profile.name ?? "", email: emailById.get(profile.id) ?? "", role: rolesMap.get(profile.role_id ?? -1) ?? "", position: positionsMap.get(profile.position_id ?? -1) ?? "", branches: branchesByUser.get(profile.id) ?? [], accessRevenue: Boolean(profile.access_revenue_dashboard) }));

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
        <p className="mt-2 text-sm text-slate-600">Pengaturan user, hak akses, dan proses data revenue.</p>
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
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Data Revenue</h2>
          <p className="mt-1 text-sm text-slate-500">Upload raw transaction dan replace berdasarkan tanggal.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <UploadRawDataButton />
            <ImportRevenueTargetButton />
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">User & Access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Kelola akses Revenue Dashboard dan branch setiap user melalui tabel di bawah.
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
