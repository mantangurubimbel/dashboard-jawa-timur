import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SummaryPoint } from "@/lib/types";

type SummaryTableProps = {
  title: string;
  data: SummaryPoint[];
  totalRevenue: number;
  columns?: "default" | "branchRevenue" | "branchStudents" | "agent";
};

export function SummaryTable({ title, data, totalRevenue, columns = "default" }: SummaryTableProps) {
  const isBranchRevenue = columns === "branchRevenue";
  const isBranchStudents = columns === "branchStudents";
  const isAgent = columns === "agent";

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Nama</th>
              {isBranchRevenue ? (
                <>
                  <th className="px-3 py-2 text-right font-semibold">New Txn</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                </>
              ) : isBranchStudents ? (
                <>
                  <th className="px-3 py-2 text-right font-semibold">Students</th>
                  <th className="px-3 py-2 text-right font-semibold">Renewal Rate</th>
                </>
              ) : isAgent ? (
                <>
                  <th className="px-3 py-2 text-right font-semibold">New Txn</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">Txn</th>
                  <th className="px-3 py-2 text-right font-semibold">Share</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.name} className="transition-colors hover:bg-slate-50">
                <td className="max-w-44 truncate px-3 py-2 font-medium text-slate-800">{row.name}</td>
                {isBranchRevenue || isAgent ? (
                  <>
                    <td className="px-3 py-2 text-right text-slate-700">{formatNumber(row.transactions)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.revenue)}</td>
                  </>
                ) : isBranchStudents ? (
                  <>
                    <td className="px-3 py-2 text-right text-slate-700">{formatNumber(row.transactions)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatPercent(row.revenue)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatNumber(row.transactions)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {formatPercent(totalRevenue ? row.revenue / totalRevenue : 0)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        {formatNumber(data.length)} baris ditampilkan
      </div>
    </section>
  );
}
