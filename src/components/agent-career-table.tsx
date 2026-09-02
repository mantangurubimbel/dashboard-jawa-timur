"use client";

import { useState } from "react";
import type { AgentCareerBranchSummary, AgentCareerWeeklyRow } from "@/lib/agent-career-data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

function Ratio({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">-</span>;
  return <span className={value >= 1 ? "text-emerald-700" : "text-rose-700"}>{formatPercent(value)}</span>;
}

export function AgentCareerTable({ rows, branches }: { rows: AgentCareerWeeklyRow[]; branches: AgentCareerBranchSummary[] }) {
  const [page, setPage] = useState(1);
  const sortedRows = rows.slice().sort((left, right) => right.weekStart.localeCompare(left.weekStart));
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / 20));
  const pageRows = sortedRows.slice((page - 1) * 20, page * 20);
  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Weekly Performance</h2>
          <p className="mt-1 text-sm text-slate-500">Target, actual revenue, and achievement by week.</p>
        </div>
        <div className="max-h-[calc(100vh-22rem)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>{["Week", "Month", "Branch", "Weekly Target", "Revenue", "Achievement"].map((label) => <th key={label} className={`px-3 py-2 font-semibold ${["Weekly Target", "Revenue", "Achievement"].includes(label) ? "text-right" : ""}`}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.weekStart} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{row.weekStart} – {row.weekEnd}</td>
                  <td className="px-3 py-2 text-slate-600">{row.month}</td>
                  <td className="px-3 py-2 text-slate-600">{row.branch}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.hasTarget ? formatCurrency(row.target) : "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrency(row.revenue)}</td>
                  <td className="px-3 py-2 text-right font-semibold"><Ratio value={row.achievement} /></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">Select an agent to view weekly performance.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span>{formatNumber(sortedRows.length)} weeks - {page} from {pageCount} pages</span>
          {pageCount > 1 ? <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Prev</button><span className="whitespace-nowrap font-medium">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Next</button></div> : null}
        </div>
      </section>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Branch Summary</h2>
          <p className="mt-1 text-sm text-slate-500">Performance across the selected career period.</p>
        </div>
        <div className="max-h-[calc(100vh-22rem)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500"><tr>{["Branch", "Weeks", "Target", "Revenue", "Achievement"].map((label) => <th key={label} className={`px-3 py-2 font-semibold ${label !== "Branch" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((row) => <tr key={`${row.branch}-${row.firstWeek}`} className="hover:bg-slate-50"><td className="px-3 py-2"><p className="text-slate-700">{row.branch}</p><p className="text-xs text-slate-400">{row.firstWeek} – {row.lastWeek}</p></td><td className="px-3 py-2 text-right text-slate-600">{formatNumber(row.weeks)}</td><td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.target)}</td><td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrency(row.revenue)}</td><td className="px-3 py-2 text-right font-semibold"><Ratio value={row.achievement} /></td></tr>)}
              {!branches.length ? <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">No branch history available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
