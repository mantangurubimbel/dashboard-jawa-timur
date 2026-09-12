type LoginActivity = {
  userId: string | null;
  email: string;
  loginCount: number;
  lastLogin: string;
};

type AdminAuditEntry = {
  id: number;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
};

function formatTimestamp(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(",", "")} WIB`;
}

export function AdminActivityLog({
  loginActivity,
  auditEntries,
}: {
  loginActivity: LoginActivity[];
  auditEntries: AdminAuditEntry[];
}) {
  return (
    <section className="grid gap-6">
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Login Activity</h2>
          <p className="mt-1 text-sm text-slate-500">Users who signed in during the last 72 hours.</p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 text-right font-semibold">Login Count</th>
                <th className="px-3 py-2 font-semibold">Last Login (WIB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loginActivity.map((row) => (
                <tr key={`${row.userId ?? row.email}-${row.email}`}>
                  <td className="px-3 py-2 text-slate-700">{row.email}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{row.loginCount}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatTimestamp(row.lastLogin)}</td>
                </tr>
              ))}
              {!loginActivity.length ? <tr><td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-500">No logins recorded in the last 72 hours.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Admin Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">Recent administrative actions performed in the dashboard.</p>
        </div>
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Time (WIB)</th>
                <th className="px-3 py-2 font-semibold">Admin</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditEntries.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatTimestamp(row.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{row.actorEmail}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.action}</td>
                  <td className="px-3 py-2 text-slate-600">{row.targetType ?? "-"}{row.targetId ? ` #${row.targetId}` : ""}</td>
                </tr>
              ))}
              {!auditEntries.length ? <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">No administrative actions recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
