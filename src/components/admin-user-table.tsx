import { ChevronDown, X } from "lucide-react";
import {
  assignDashboardBranch,
  removeDashboardBranch,
  toggleRevenueDashboardAccess,
} from "@/app/(dashboard)/settings/actions";
import { BranchAccessMultiSelect } from "@/components/branch-access-multi-select";
import { FormPendingIndicator, PendingSubmitButton } from "@/components/form-submit-controls";

type AdminUser = {
  id: string;
  name: string;
  position: string;
  branches: { id: number; name: string }[];
  accessRevenue: boolean;
};

type BranchOption = { id: number; name: string };

function BranchAccessEditor({ user, branchOptions }: { user: AdminUser; branchOptions: BranchOption[] }) {
  const assignedBranchIds = new Set(user.branches.map((branch) => branch.id));
  const availableBranches = branchOptions.filter((branch) => !assignedBranchIds.has(branch.id));

  return (
    <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
      <form action={assignDashboardBranch} className="grid content-start gap-2">
        <input name="user_id" type="hidden" value={user.id} />
        <label className="grid gap-1.5 text-xs font-bold text-slate-600" htmlFor={`branch-select-${user.id}`}>
          Branch Access
          <BranchAccessMultiSelect id={`branch-select-${user.id}`} name="branch_id" options={availableBranches} />
        </label>
        <p className="text-xs leading-5 text-slate-500">
          {availableBranches.length
            ? "Pilih satu atau beberapa branch dari dropdown."
            : "Semua branch sudah ditambahkan."}
        </p>
        <div className="flex items-center gap-2">
          <PendingSubmitButton
            className="inline-flex h-8 items-center justify-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!availableBranches.length}
          >
            Add branch
          </PendingSubmitButton>
          <FormPendingIndicator />
        </div>
      </form>

      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-600">List Branch Access</p>
        <div className="mt-2 flex min-h-10 flex-wrap content-start gap-2 rounded-md border border-slate-200 bg-white p-2">
          {user.branches.length ? (
            user.branches.map((branch) => (
              <form action={removeDashboardBranch} className="inline-flex" key={branch.id}>
                <input name="user_id" type="hidden" value={user.id} />
                <input name="branch_id" type="hidden" value={branch.id} />
                <PendingSubmitButton
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
                  title={`Hapus akses ${branch.name}`}
                >
                  <span className="max-w-52 truncate">{branch.name}</span>
                  <X className="h-3 w-3 shrink-0" aria-hidden />
                  <FormPendingIndicator className="h-3 w-3 text-rose-700" />
                </PendingSubmitButton>
              </form>
            ))
          ) : (
            <span className="self-center px-1 text-xs text-slate-400">No branch assigned</span>
          )}
        </div>
      </div>

      <form action={toggleRevenueDashboardAccess} className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 lg:col-span-2">
        <div>
          <p className="text-xs font-bold text-slate-600">Is Active</p>
          <p className="mt-1 text-xs text-slate-500">
            {user.accessRevenue ? "User dapat mengakses Revenue Dashboard." : "User tidak dapat mengakses Revenue Dashboard."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <input name="user_id" type="hidden" value={user.id} />
          <input name="access" type="hidden" value={String(!user.accessRevenue)} />
          <span className={`text-xs font-semibold ${user.accessRevenue ? "text-emerald-700" : "text-slate-500"}`}>
            {user.accessRevenue ? "Active" : "Disabled"}
          </span>
          <PendingSubmitButton
            aria-label={`${user.accessRevenue ? "Disable" : "Enable"} Revenue Dashboard untuk ${user.name || "user"}`}
            aria-pressed={user.accessRevenue}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-70 ${user.accessRevenue ? "bg-teal-700" : "bg-slate-100"}`}
            title={user.accessRevenue ? "Disable Revenue Dashboard" : "Enable Revenue Dashboard"}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${user.accessRevenue ? "translate-x-5" : "translate-x-0"}`}
            >
              <FormPendingIndicator className="h-3 w-3 text-teal-700" />
              {!user.accessRevenue ? <span className="sr-only">Inactive</span> : null}
            </span>
          </PendingSubmitButton>
          <FormPendingIndicator className="h-4 w-4 text-teal-700" />
        </div>
      </form>
    </div>
  );
}

export function AdminUserTable({
  users,
  branchOptions,
}: {
  users: AdminUser[];
  branchOptions: BranchOption[];
}) {
  return (
    <section className="flex h-[calc(100vh-22rem)] min-h-[360px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Daftar User</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola branch yang dapat diakses dan status Revenue Dashboard setiap user.</p>
        </div>
        <span className="text-xs font-medium text-slate-500">{users.length} user</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-2">
          {users.map((user) => (
            <details className="group rounded-md border border-slate-200 bg-white" key={user.id}>
              <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1.4fr)_minmax(150px,1fr)_130px_110px_62px] sm:items-center [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                  <p className="truncate text-sm font-bold text-slate-800">{user.name || "-"}</p>
                </div>
                <p className="truncate text-xs font-semibold text-slate-500">{user.position || "Belum ada posisi"}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-center text-xs font-bold text-teal-700">
                  {user.branches.length} branch
                </span>
                <span className={`text-center text-xs font-bold ${user.accessRevenue ? "text-emerald-700" : "text-slate-500"}`}>
                  {user.accessRevenue ? "Active" : "Disabled"}
                </span>
                <span className="text-right text-xs font-bold text-teal-700 group-open:text-slate-500">Edit</span>
              </summary>
              <BranchAccessEditor branchOptions={branchOptions} user={user} />
            </details>
          ))}
          {!users.length ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Belum ada user yang memenuhi kriteria.
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Hanya user dengan user grade 2 atau lebih yang ditampilkan.
      </div>
    </section>
  );
}
