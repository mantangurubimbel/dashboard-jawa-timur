"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "@/lib/format";

type LoyalStudent = {
  nis: string;
  name: string;
  grade: string;
  branch: string;
  purchases: number;
  academicYears: string;
  userSerial: string;
  email: string;
  birthDate: string;
  history: { academicYear: string; grade: string; school: string; branch: string }[];
};

export function StudentLoyalTable({ rows }: { rows: LoyalStudent[] }) {
  const [page, setPage] = useState(1);
  const [possibleRenewNextAy, setPossibleRenewNextAy] = useState(false);
  const visibleRows = possibleRenewNextAy ? rows.filter((row) => row.grade !== "12 SMA") : rows;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / 20));
  const pageRows = visibleRows.slice((page - 1) * 20, page * 20);
  const [hoveredStudent, setHoveredStudent] = useState<LoyalStudent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const updateTooltipPosition = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 620;
    const gap = 8;
    const left = Math.min(Math.max(gap, rect.right + gap), Math.max(gap, window.innerWidth - width - gap));
    setTooltipPosition({ top: Math.max(gap, Math.round(window.innerHeight / 2)), left });
  }, []);

  useEffect(() => {
    if (!hoveredStudent) return;
    const update = () => {
      const anchor = document.querySelector<HTMLElement>(
        `[data-loyal-student-anchor="${hoveredStudent.nis}"]`,
      );
      if (anchor) updateTooltipPosition(anchor);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoveredStudent, updateTooltipPosition]);

  return (
    <>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Loyal Students</h2>
          <div className="mt-1 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Students registered across multiple academic years</p>
            <label className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={possibleRenewNextAy}
              onChange={(event) => {
                setPossibleRenewNextAy(event.target.checked);
                setPage(1);
                setHoveredStudent(null);
              }}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 accent-teal-700"
            />
              <span>Possible renew for next AY</span>
            </label>
          </div>
        </div>
        <div className="max-h-[calc(100vh-18rem)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                {["NIS", "Name", "Grade", "Branch", "BAC Purchases", "Academic Years"].map((label) => (
                  <th key={label} className="px-3 py-2 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.nis} className="transition-colors hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span
                      data-loyal-student-anchor={row.nis}
                      className="font-mono text-xs text-teal-700 hover:text-teal-900"
                      onMouseEnter={(event) => {
                        setHoveredStudent(row);
                        updateTooltipPosition(event.currentTarget);
                      }}
                      onMouseLeave={(event) => {
                        const relatedTarget = event.relatedTarget as Node | null;
                        if (!relatedTarget || !(relatedTarget as HTMLElement).closest?.("[data-loyal-student-tooltip]")) {
                          setHoveredStudent(null);
                        }
                      }}
                    >
                      {row.nis}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                  <td className={`px-3 py-2 ${row.grade === "12 SMA" ? "text-rose-700" : "text-emerald-700"}`}>{row.grade}</td>
                  <td className="px-3 py-2 text-slate-600">{row.branch}</td>
                  <td className="px-3 py-2 text-center font-semibold text-teal-700">{formatNumber(row.purchases)}</td>
                  <td className="px-3 py-2 text-slate-600">{row.academicYears}</td>
                </tr>
              ))}
              {!visibleRows.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No loyal students found for this academic year.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <span>{formatNumber(visibleRows.length)} loyal students - {page} from {pageCount} pages</span>
            {pageCount > 1 ? <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Prev</button><span className="whitespace-nowrap text-xs font-medium">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Next</button></div> : null}
          </div>
        </div>
      </section>
      {hoveredStudent ? createPortal(
        <div
          data-loyal-student-tooltip
          className="pointer-events-auto fixed z-[100] w-[620px] max-w-[calc(100vw-1rem)] overflow-auto rounded-md border border-slate-200 bg-white shadow-xl"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left, transform: "translateY(-50%)", maxHeight: "calc(100vh - 16px)" }}
          onMouseEnter={() => setHoveredStudent(hoveredStudent)}
          onMouseLeave={() => setHoveredStudent(null)}
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="font-semibold text-slate-950">{hoveredStudent.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{hoveredStudent.nis}</p>
          </div>
          <div className="grid gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2">
            <p className="text-xs text-slate-700"><span className="font-semibold">User Serial</span><br />{hoveredStudent.userSerial}</p>
            <p className="text-xs text-slate-700"><span className="font-semibold">Email</span><br />{hoveredStudent.email}</p>
            <p className="text-xs text-slate-700"><span className="font-semibold">Birth Date</span><br />{hoveredStudent.birthDate}</p>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  {["Academic Year", "Grade", "Source School", "Branch"].map((label) => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hoveredStudent.history.map((item, index) => (
                  <tr key={`${item.academicYear}-${index}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{item.academicYear}</td>
                    <td className="px-3 py-2">{item.grade}</td>
                    <td className="px-3 py-2">{item.school}</td>
                    <td className="px-3 py-2">{item.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            {formatNumber(hoveredStudent.history.length)} purchase history records
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
