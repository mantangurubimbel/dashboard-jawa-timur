import { CheckCircle2, XCircle } from "lucide-react";

type AdminUser = { id: string; name: string; email: string; accessRevenue: boolean };

export function AdminUserTable({ users }: { users: AdminUser[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">User &amp; Dashboard Access</h2>
        <p className="mt-1 text-sm text-slate-500">Daftar user dan status akses Revenue Dashboard.</p>
      </div>
      <div className="max-h-[calc(100vh-24rem)] min-h-[240px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3 font-semibold">Nama</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Revenue Dashboard</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => <tr key={user.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{user.name || "-"}</td><td className="px-4 py-3 text-slate-600">{user.email || "-"}</td><td className="px-4 py-3">{user.accessRevenue ? <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Active</span> : <span className="inline-flex items-center gap-1.5 text-slate-500"><XCircle className="h-4 w-4" />Disabled</span>}</td></tr>)}
            {!users.length ? <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Belum ada user.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{users.length} user ditampilkan</div>
    </section>
  );
}
