import { CheckCircle2, XCircle } from "lucide-react";
import { assignDashboardBranch, removeDashboardBranch, toggleRevenueDashboardAccess } from "@/app/(dashboard)/settings/actions";

type AdminUser = { id: string; name: string; email: string; role: string; position: string; branches: { id: number; name: string }[]; accessRevenue: boolean };

export function AdminUserTable({ users, branchOptions }: { users: AdminUser[]; branchOptions: { id: number; name: string }[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">User &amp; Dashboard Access</h2>
        <p className="mt-1 text-sm text-slate-500">Daftar user dan status akses Revenue Dashboard.</p>
      </div>
      <div className="max-h-[calc(100vh-24rem)] min-h-[240px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3 font-semibold">Nama</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Position</th><th className="px-4 py-3 font-semibold">Branch Access</th><th className="px-4 py-3 font-semibold">Revenue Dashboard</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => <tr key={user.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{user.name || "-"}</td><td className="px-4 py-3 text-slate-600">{user.email || "-"}</td><td className="px-4 py-3 text-slate-600">{user.role || "-"}</td><td className="px-4 py-3 text-slate-600">{user.position || "-"}</td><td className="min-w-72 px-4 py-3 text-slate-600"><div className="flex flex-wrap gap-1">{user.branches.length ? user.branches.map((branch) => <form key={branch.id} action={removeDashboardBranch}><input type="hidden" name="user_id" value={user.id} /><input type="hidden" name="branch_id" value={branch.id} /><button type="submit" className="rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-rose-100 hover:text-rose-700" title="Remove branch">{branch.name} ×</button></form>) : <span className="text-xs text-slate-400">No branch assigned</span>}</div><form action={assignDashboardBranch} className="mt-2 flex gap-1"><input type="hidden" name="user_id" value={user.id} /><select name="branch_id" defaultValue="" className="h-7 min-w-40 rounded border border-slate-300 bg-white px-1 text-xs"><option value="" disabled>Add branch...</option>{branchOptions.filter((branch) => !user.branches.some((current) => current.id === branch.id)).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><button type="submit" className="h-7 rounded bg-teal-700 px-2 text-xs font-semibold text-white hover:bg-teal-800">Add</button></form></td><td className="px-4 py-3"><form action={toggleRevenueDashboardAccess} className="flex items-center gap-3">{user.accessRevenue ? <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Active</span> : <span className="inline-flex items-center gap-1.5 text-slate-500"><XCircle className="h-4 w-4" />Disabled</span>}<input type="hidden" name="user_id" value={user.id} /><input type="hidden" name="access" value={String(!user.accessRevenue)} /><button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">{user.accessRevenue ? "Disable" : "Enable"}</button></form></td></tr>)}
            {!users.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada user.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{users.length} user ditampilkan</div>
    </section>
  );
}
