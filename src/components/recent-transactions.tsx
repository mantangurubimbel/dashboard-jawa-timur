import { formatCurrency, formatNumber } from "@/lib/format";
import { RecentTransaction } from "@/lib/types";

export function RecentTransactions({ data }: { data: RecentTransaction[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Recent Transactions</h2>
          <p className="mt-1 text-sm text-slate-500">10 most recent transactions by payment date.</p>
        </div>
        <span className="text-xs font-medium text-slate-400">{formatNumber(data.length)} rows</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Invoice</th>
              <th className="px-3 py-2 font-semibold">Product</th>
              <th className="px-3 py-2 font-semibold">Branch</th>
              <th className="px-3 py-2 text-right font-semibold">Revenue</th>
              <th className="px-3 py-2 font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.paymentDate}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.invoice}</td>
                <td className="px-3 py-2 text-slate-600">{row.product}</td>
                <td className="max-w-48 truncate px-3 py-2 text-slate-600">{row.branch}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.flags.length ? row.flags.map((flag) => (
                      <span key={flag} className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700">
                        {flag}
                      </span>
                    )) : <span className="text-slate-400">-</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!data.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No transactions match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        {formatNumber(data.length)} rows displayed
      </div>
    </section>
  );
}
