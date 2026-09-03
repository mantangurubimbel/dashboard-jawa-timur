import type { BranchCareerWeeklyRow } from "@/lib/branch-career-data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

function Achievement({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">-</span>;
  return <span className={value >= 1 ? "text-emerald-700" : "text-rose-700"}>{formatPercent(value)}</span>;
}

export function BranchCareerTable({ rows }: { rows: BranchCareerWeeklyRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Weekly Performance</h2>
        <p className="mt-1 text-sm text-slate-500">Target, actual revenue, and LY comparison by week.</p>
      </div>
      <div className="max-h-[calc(100vh-22rem)] min-h-[260px] overflow-auto">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              {["Week", "Month", "Weekly Target", "Revenue", "Revenue LY", "Achievement"].map((label) => (
                <th key={label} className={`px-3 py-2 font-semibold ${["Week", "Month"].includes(label) ? "" : "text-right"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.weekStart} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{row.weekStart} – {row.weekEnd}</td>
                <td className="px-3 py-2 text-slate-600">{row.month}</td>
                <td className="px-3 py-2 text-right text-slate-700">{row.hasTarget ? formatCurrency(row.target) : "-"}</td>
                <td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrency(row.revenue)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.lyRevenue)}</td>
                <td className="px-3 py-2 text-right font-semibold"><Achievement value={row.achievement} /></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">No weekly performance available.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">{formatNumber(rows.length)} weeks</div>
    </section>
  );
}
