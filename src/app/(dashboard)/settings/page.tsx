import { Settings2 } from "lucide-react";
import { ImportRevenueTargetButton } from "@/components/import-revenue-target-button";
import { UploadRawDataButton } from "@/components/upload-raw-data-button";
import { supabaseRestFetch } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function fetchCount(table: string) {
  const response = await supabaseRestFetch(`${table}?select=*&limit=1`);
  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  return range ? Number(range.split("/")[1]) || 0 : 0;
}

export default async function SettingsPage() {
  const [users, branches, roles] = await Promise.all([
    fetchCount("t_app_user"),
    fetchCount("t_branch"),
    fetchCount("t_role"),
  ]);

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
            Modul user management berikutnya dapat menggunakan `t_app_user`, `t_role`, `t_position`, dan `t_app_user_branch`.
            Halaman ini sudah disiapkan sebagai entry point terpisah.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" disabled className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">Tambah User</button>
            <button type="button" disabled className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">Role Access</button>
            <button type="button" disabled className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">Branch Access</button>
          </div>
        </div>
      </section>
    </div>
  );
}
