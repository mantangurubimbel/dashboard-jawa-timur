"use client";

import { formatCurrency, formatNumber } from "@/lib/format";
import { AgentPerformance } from "@/lib/types";
import { useState } from "react";

export function AgentPerformanceTable({
  data,
  productivityWeekdays,
  showRevenuePerNewTxn = false,
}: {
  data: AgentPerformance[];
  productivityWeekdays?: number;
  showRevenuePerNewTxn?: boolean;
}) {
  const sortedRows = data
    .slice()
    .sort((a, b) => b.revenueNonBulkBuying - a.revenueNonBulkBuying || a.agent.localeCompare(b.agent));
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / 20));
  const rows = sortedRows.slice((page - 1) * 20, page * 20);

  return (
    <section className="flex max-h-[calc(100vh-18rem)] min-h-[360px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">Agent Performance</h2>
        <p className="mt-1 text-sm text-slate-500">Revenue and productivity by agent</p>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Rank",
                "Agent",
                "Branch",
                "Non-Bulk Revenue",
                "New Non-Bulk Txn",
                showRevenuePerNewTxn ? "AOV New Txn" : "Txn Non Bulk",
                productivityWeekdays === undefined ? "Schools" : "Productivity",
              ].map((label, index) => (
                <th key={label} className={`sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold ${index >= 3 ? "text-right" : ""}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${row.agent}-${row.branch}-${index}`} className="transition-colors hover:bg-slate-50">
              <td className="px-3 py-2 font-semibold text-slate-500">{(page - 1) * 20 + index + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.agent}</td>
                <td className="px-3 py-2 text-slate-600">{row.branch}</td>
                <td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrency(row.revenueNonBulkBuying)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatNumber(row.newTxnNonBulkBuying)}</td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {showRevenuePerNewTxn
                    ? row.newTxnNonBulkBuying > 0
                      ? formatCurrency(row.revenueNewTxnNonBulkBuying / row.newTxnNonBulkBuying)
                      : "-"
                    : formatNumber(row.transactionsNonBulkBuying)}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {productivityWeekdays === undefined
                    ? formatNumber(row.schools)
                    : productivityWeekdays > 0
                      ? (row.newTxnNonBulkBuying / productivityWeekdays).toFixed(2)
                      : "-"}
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No agent data matches this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
        <span>{formatNumber(sortedRows.length)} agent - {page} from {pageCount} pages</span>
        {pageCount > 1 ? <div className="flex items-center gap-2">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-40">Prev</button>
          <span className="whitespace-nowrap font-medium text-slate-700">{page} / {pageCount}</span>
          <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-40">Next</button>
        </div> : null}
      </div>
    </section>
  );
}
