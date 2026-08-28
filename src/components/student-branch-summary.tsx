import { formatNumber } from "@/lib/format";

type BranchSummaryRow = {
  branch: string;
  current: number;
  lySamePeriod: number;
  lyEndOfYear: number;
  l2ySamePeriod: number;
  l2yEndOfYear: number;
};

export function StudentBranchSummary({ rows }: { rows: BranchSummaryRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Student Summary by Branch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Comparison of unique student counts for the active academic year, LY, and L2Y.
        </p>
      </div>
      <div className="max-h-[calc(100vh-18rem)] min-h-[360px] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
          <tr>
            {["Branch", "Students", "vs LY (same period)", "vs L2Y (same period)", "Students LY (same period)", "Students LY (end of academic year)", "Students L2Y (same period)", "Students L2Y (end of academic year)"].map((label, index) => (
              <th key={label} className={`px-3 py-2 font-semibold ${index > 0 ? "text-center" : ""} ${[1, 4, 6].includes(index) ? "border-l border-slate-300" : ""}`}>
                {label}
              </th>
            ))}
          </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.branch} className="transition-colors hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-800">{row.branch}</td>
              <td className="border-l border-slate-300 px-3 py-2 text-center font-semibold text-teal-700">{formatNumber(row.current)}</td>
              <td className="px-3 py-2 text-center text-slate-600">
                {row.lySamePeriod > 0 ? (
                  <span className={row.current / row.lySamePeriod < 1 ? "text-rose-700" : row.current / row.lySamePeriod > 1 ? "text-emerald-700" : "text-slate-600"}>
                    {(row.current / row.lySamePeriod).toFixed(2)}x
                  </span>
                ) : "-"}
              </td>
              <td className="px-3 py-2 text-center text-slate-600">
                {row.l2ySamePeriod > 0 ? (
                  <span className={row.current / row.l2ySamePeriod < 1 ? "text-rose-700" : row.current / row.l2ySamePeriod > 1 ? "text-emerald-700" : "text-slate-600"}>
                    {(row.current / row.l2ySamePeriod).toFixed(2)}x
                  </span>
                ) : "-"}
              </td>
              <td className="border-l border-slate-300 px-3 py-2 text-center text-slate-600">{formatNumber(row.lySamePeriod)}</td>
              <td className="px-3 py-2 text-center text-slate-600">{formatNumber(row.lyEndOfYear)}</td>
              <td className="border-l border-slate-300 px-3 py-2 text-center text-slate-600">{formatNumber(row.l2ySamePeriod)}</td>
              <td className="px-3 py-2 text-center text-slate-600">{formatNumber(row.l2yEndOfYear)}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-500">No branch data available.</td>
            </tr>
          ) : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {formatNumber(rows.length)} branches displayed
      </div>
    </section>
  );
}
