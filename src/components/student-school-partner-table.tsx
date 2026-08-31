"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "@/lib/format";

type SchoolPartnerRow = {
  npsn: string;
  school: string;
  level: string;
  students: number;
  lySamePeriod: number;
  lyEndOfYear: number;
  l2ySamePeriod: number;
  l2yEndOfYear: number;
  history: {
    academicYear: string;
    counts: Record<string, number>;
    total: number;
  }[];
};

function Ratio({
  samePeriod,
  endOfYear,
  current,
}: {
  samePeriod: number;
  endOfYear: number;
  current: number;
}) {
  const samePeriodRatio = samePeriod > 0 ? current / samePeriod : null;
  const endOfYearRatio = endOfYear > 0 ? current / endOfYear : null;

  const renderRatio = (ratio: number | null) => {
    const isUp = ratio !== null && ratio > 1;
    const isDown = ratio !== null && ratio < 1;
    const className = isUp
      ? "inline-flex items-center gap-0.5 text-emerald-700"
      : isDown
        ? "inline-flex items-center gap-0.5 text-rose-700"
        : "text-slate-600";

    return (
      <span className={className}>
        {isUp ? <ArrowUp className="h-3 w-3" aria-hidden /> : null}
        {isDown ? <ArrowDown className="h-3 w-3" aria-hidden /> : null}
        {ratio === null ? "-" : `${ratio.toFixed(2)}x`}
      </span>
    );
  };

  return (
    <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
      {renderRatio(samePeriodRatio)}
      <span className="text-slate-400">/</span>
      {renderRatio(endOfYearRatio)}
    </span>
  );
}

function columnsForLevel(level: string) {
  if (level === "SMA") return ["10 SMA", "11 SMA", "12 SMA", "Gapyear"];
  if (level === "SMP") return ["7 SMP", "8 SMP", "9 SMP"];
  return ["3 SD", "4 SD", "5 SD", "6 SD"];
}

function SchoolHistoryTooltip({
  school,
  position,
  onMouseEnter,
  onMouseLeave,
}: {
  school: SchoolPartnerRow;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const columns = columnsForLevel(school.level);

  return (
    <div
      data-school-partner-tooltip
      className="pointer-events-auto fixed z-[100] max-h-[calc(100vh-1rem)] w-[620px] max-w-[calc(100vw-1rem)] overflow-auto rounded-md border border-slate-200 bg-white shadow-xl"
      style={{ top: position.top, left: position.left, transform: "translateY(-50%)", maxHeight: "calc(100vh - 16px)" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="font-semibold text-slate-950">{school.school}</p>
        <p className="mt-0.5 text-xs text-slate-500">{school.npsn} · {school.level}</p>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Academic Year</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-center font-semibold">
                  {column}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {school.history.map((year) => (
              <tr key={year.academicYear} className="transition-colors hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{year.academicYear}</td>
                {columns.map((column) => (
                  <td key={`${year.academicYear}-${column}`} className="px-3 py-2 text-center text-slate-600">
                    {formatNumber(year.counts[column] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-semibold text-teal-700">
                  {formatNumber(year.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {formatNumber(school.history.length)} academic years displayed
      </div>
    </div>
  );
}

export function StudentSchoolPartnerTable({ rows }: { rows: SchoolPartnerRow[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const pageRows = rows.slice((page - 1) * 20, page * 20);
  const [hoveredSchool, setHoveredSchool] = useState<SchoolPartnerRow | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [selectedLevel, setSelectedLevel] = useState("");
  const filteredRows = selectedLevel
    ? rows.filter((row) => row.level === selectedLevel)
    : rows;

  const updateTooltipPosition = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 620;
    const gap = 8;
    const top = Math.max(gap, Math.round(window.innerHeight / 2));
    const left = Math.min(
      Math.max(gap, rect.right + gap),
      Math.max(gap, window.innerWidth - width - gap),
    );

    setTooltipPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!hoveredSchool) return;

    const update = () => {
      const anchor = document.querySelector<HTMLElement>(
        `[data-school-partner-anchor="${hoveredSchool.npsn}"]`,
      );
      if (anchor) updateTooltipPosition(anchor);
    };

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoveredSchool, updateTooltipPosition]);

  return (
    <>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">School Partner</h2>
          <p className="mt-1 text-sm text-slate-500">School ranking based on BAC student count</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">School level</span>
            <select
              value={selectedLevel}
              onChange={(event) => {
                setSelectedLevel(event.target.value);
                setHoveredSchool(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              aria-label="Filter school level"
            >
              <option value="">All levels</option>
              {["SMA", "SMP", "SD", "-"].map((level) => (
                <option key={level} value={level}>{level === "-" ? "Unmapped" : level}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="max-h-[calc(100vh-18rem)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                {["NPSN", "School Name", "Level", "Students", "vs LY", "vs L2Y"].map((label, index) => (
                  <th key={label} className={`px-3 py-2 font-semibold ${index > 2 ? "text-center" : ""}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.npsn} className="transition-colors hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span
                      data-school-partner-anchor={row.npsn}
                      className="font-mono text-xs text-slate-500 hover:text-teal-700"
                      onMouseEnter={(event) => {
                        setHoveredSchool(row);
                        updateTooltipPosition(event.currentTarget);
                      }}
                      onMouseLeave={(event) => {
                        const relatedTarget = event.relatedTarget as Node | null;
                        if (!relatedTarget || !(relatedTarget as HTMLElement).closest?.("[data-school-partner-tooltip]")) {
                          setHoveredSchool(null);
                        }
                      }}
                    >
                      {row.npsn}
                    </span>
                  </td>
                  <td className="max-w-72 truncate px-3 py-2 font-medium text-slate-800" title={row.school}>{row.school}</td>
                  <td className="px-3 py-2 text-slate-600">{row.level}</td>
                  <td className="px-3 py-2 text-center font-semibold text-teal-700">{formatNumber(row.students)}</td>
                  <td className="px-3 py-2 text-center"><Ratio current={row.students} samePeriod={row.lySamePeriod} endOfYear={row.lyEndOfYear} /></td>
                  <td className="px-3 py-2 text-center"><Ratio current={row.students} samePeriod={row.l2ySamePeriod} endOfYear={row.l2yEndOfYear} /></td>
                </tr>
              ))}
              {!filteredRows.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No School Partner data available.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <span>{formatNumber(filteredRows.length)} schools shown - {page} from {pageCount} pages</span>
            {pageCount > 1 ? <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Prev</button><span className="whitespace-nowrap text-xs font-medium">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} className="h-7 rounded border px-2 text-xs disabled:opacity-40">Next</button></div> : null}
          </div>
        </div>
      </section>
      {hoveredSchool ? createPortal(
        <SchoolHistoryTooltip
          school={hoveredSchool}
          position={tooltipPosition}
          onMouseEnter={() => setHoveredSchool(hoveredSchool)}
          onMouseLeave={() => setHoveredSchool(null)}
        />,
        document.body,
      ) : null}
    </>
  );
}
