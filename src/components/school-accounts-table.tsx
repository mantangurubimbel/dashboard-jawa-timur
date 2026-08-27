"use client";

import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/format";

type SchoolAccount = {
  npsn: string;
  school: string;
  city: string;
  revenue: number;
  transactions: number;
  invoices: number;
  branches: { branch: string; revenue: number; transactions: number }[];
};

export function SchoolAccountsTable({
  rows,
  title = "Kontributor Total Revenue",
  subtitle = "Ranking sekolah dengan penjualan retail & bulk buying",
}: {
  rows: SchoolAccount[];
  title?: string;
  subtitle?: string;
}) {
  const rowsPerPage = 20;
  const [page, setPage] = useState(1);
  const [hoveredSchool, setHoveredSchool] = useState<SchoolAccount | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const visibleRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const updatePopoverPosition = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 320;
    const estimatedHeight = Math.min(360, 96 + (hoveredSchool?.branches.length ?? 1) * 28);
    const gap = 8;
    const top =
      rect.bottom + estimatedHeight + gap <= window.innerHeight
        ? rect.bottom + gap
        : Math.max(gap, rect.top - estimatedHeight - gap);
    const left = Math.min(
      Math.max(gap, rect.right - width),
      Math.max(gap, window.innerWidth - width - gap),
    );

    setPopoverPosition({ top, left });
  }, [hoveredSchool]);

  useEffect(() => {
    if (!hoveredSchool) return;

    const handleViewportChange = () => {
      const anchor = document.querySelector<HTMLElement>(
        `[data-school-anchor="${hoveredSchool.npsn}"]`,
      );
      if (anchor) updatePopoverPosition(anchor);
    };

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [hoveredSchool, updatePopoverPosition]);

  return (
    <div className="flex max-h-[calc(100vh-18rem)] min-h-[360px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>
              <th className="sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold">Rank</th>
            <th className="sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold">NPSN</th>
            <th className="sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold">Sekolah</th>
            <th className="sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold">Kota/Kabupaten</th>
            <th className="sticky top-0 z-10 bg-slate-100 px-3 py-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleRows.map((row, index) => (
            <tr key={row.npsn} className="group transition-colors hover:bg-slate-50">
              <td className="px-3 py-2 font-semibold text-slate-500">
                {(page - 1) * rowsPerPage + index + 1}
              </td>
              <td
                className="px-3 py-2 font-mono text-xs text-slate-500"
              >
                {row.npsn}
              </td>
              <td
                className="px-3 py-2"
                data-school-anchor={row.npsn}
                onMouseEnter={(event) => {
                  setHoveredSchool(row);
                  updatePopoverPosition(event.currentTarget);
                }}
                onMouseLeave={(event) => {
                  const relatedTarget = event.relatedTarget as Node | null;
                  if (!relatedTarget || !(relatedTarget as HTMLElement).closest?.("[data-school-popover]")) {
                    setHoveredSchool(null);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{row.school}</span>
                  <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                </div>
              </td>
              <td className="px-3 py-2 text-slate-600">{row.city}</td>
              <td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrency(row.revenue)}</td>
            </tr>
          ))}
          {!visibleRows.length ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                Belum ada data sekolah.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>
          {rows.length
            ? `${(page - 1) * rowsPerPage + 1}-${Math.min(page * rowsPerPage, rows.length)} dari ${rows.length}`
            : "0 data"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setHoveredSchool(null);
              setPage((current) => Math.max(1, current - 1));
            }}
            disabled={page === 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Halaman sebelumnya"
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-16 text-center font-medium text-slate-700">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => {
              setHoveredSchool(null);
              setPage((current) => Math.min(totalPages, current + 1));
            }}
            disabled={page === totalPages}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Halaman berikutnya"
            title="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {hoveredSchool
        ? createPortal(
            <div
              data-school-popover
              className="pointer-events-auto fixed z-[100] w-80 rounded-md border border-slate-200 bg-white p-3 text-left shadow-xl"
              style={{ top: popoverPosition.top, left: popoverPosition.left }}
              onMouseLeave={() => setHoveredSchool(null)}
              onMouseEnter={() => setHoveredSchool(hoveredSchool)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{hoveredSchool.school}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Revenue per branch</p>
                </div>
                <span className="text-xs font-semibold text-teal-700">
                  {formatCurrency(hoveredSchool.revenue)}
                </span>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {hoveredSchool.branches.map((branch) => (
                  <div key={branch.branch} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-600">{branch.branch}</span>
                    <span className="whitespace-nowrap font-semibold text-slate-800">
                      {formatCurrency(branch.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
