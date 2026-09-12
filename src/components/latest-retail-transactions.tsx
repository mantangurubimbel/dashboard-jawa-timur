"use client";

import { useEffect, useState } from "react";
import type { LatestRetailTransaction } from "@/lib/types";

// Avoid locale-dependent Intl output in this hydrated client component. The
// server and browser can render id-ID currency spacing differently.
function formatCurrencyStable(value: number) {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(2)} M`;
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)} jt`;
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${sign}${digits}`;
}

function formatCountStable(value: number) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function LatestRetailTransactions({ data }: { data: LatestRetailTransaction[] }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(data);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setRows([]);
      try {
        const response = await fetch(`/api/latest-retail-transactions?search=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = (await response.json()) as { data?: LatestRetailTransaction[] };
        if (response.ok && !controller.signal.aborted) setRows(result.data ?? []);
      } catch {
        // Ignore aborted requests when the user continues typing.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [data, query]);
  const visibleRows = query.trim() ? rows : data;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Latest Retail Transaction</h2>
          <p className="mt-1 text-sm text-slate-500">New Txn &amp; Installment, not include bulk buying</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agent or invoice"
          aria-label="Search agent or invoice"
          className="h-8 w-full max-w-xs rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <div className="mt-4 max-h-[32rem] overflow-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              {['Payment Date', 'Invoice', 'Branch', 'Agent', 'Product', 'Revenue'].map((label) => (
                <th key={label} className={`px-3 py-2 font-semibold ${label === 'Revenue' ? 'text-right' : ''}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">Loading transactions...</td></tr> : null}
            {!loading && visibleRows.map((row) => (
              <tr key={`${row.id}-${row.invoice}`} className="transition-colors hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.paymentDate}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.invoice}</td>
                <td className="px-3 py-2 text-slate-600">{row.branch}</td>
                <td className="px-3 py-2 text-slate-600">{row.agent}</td>
                <td className="px-3 py-2 text-slate-600">{row.product}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">{formatCurrencyStable(row.revenue)}</td>
              </tr>
            ))}
            {!loading && !visibleRows.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">{query.trim() ? "No transactions match your search." : "No retail transactions available."}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        {formatCountStable(visibleRows.length)} rows
        {query.trim() ? " matching rows" : null}
      </div>
    </section>
  );
}
