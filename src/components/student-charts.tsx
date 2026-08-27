"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

const colors = ["#0f766e", "#2563eb", "#c2410c", "#7c3aed", "#be123c", "#0f172a"];

function TooltipBox({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: {
      name?: string;
      period?: string;
      students: number;
      cumulativeStudents?: number;
      lySamePeriod?: number;
      l2ySamePeriod?: number;
    };
  }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const isComparisonPoint = point.lySamePeriod !== undefined && point.l2ySamePeriod !== undefined;
  const lySamePeriod = point.lySamePeriod ?? 0;
  const l2ySamePeriod = point.l2ySamePeriod ?? 0;
  const lyGrowth = lySamePeriod > 0 ? point.students / lySamePeriod : null;
  const l2yGrowth = l2ySamePeriod > 0 ? point.students / l2ySamePeriod : null;

  return (
    <div className="w-56 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{point.name ?? point.period}</p>
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between gap-4 font-semibold text-teal-700">
          <span>{isComparisonPoint ? "Jumsis" : "Student"}</span>
          <span className="text-right">{formatNumber(point.students)}</span>
        </div>
        {point.cumulativeStudents !== undefined ? (
          <div className="flex items-center justify-between gap-4 text-xs text-blue-700">
            <span>Kumulatif</span>
            <span className="text-right">{formatNumber(point.cumulativeStudents)}</span>
          </div>
        ) : null}
        {isComparisonPoint ? (
          <>
            <div className={`flex items-center justify-between gap-4 text-xs ${lyGrowth !== null && lyGrowth < 1 ? "text-rose-700" : lyGrowth !== null && lyGrowth > 1 ? "text-emerald-700" : "text-slate-600"}`}>
              <span>vs LY SP</span>
              <span className="text-right">
                {lyGrowth === null ? "-" : `${lyGrowth.toFixed(2)}x`}
              </span>
            </div>
            <div className={`flex items-center justify-between gap-4 text-xs ${l2yGrowth !== null && l2yGrowth < 1 ? "text-rose-700" : l2yGrowth !== null && l2yGrowth > 1 ? "text-emerald-700" : "text-slate-600"}`}>
              <span>vs L2Y SP</span>
              <span className="text-right">
                {l2yGrowth === null ? "-" : `${l2yGrowth.toFixed(2)}x`}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function StudentTrendChart({
  data,
  subtitle = "Jumlah student berdasarkan payment date.",
  showCumulative = false,
}: {
  data: { period: string; students: number }[];
  subtitle?: string;
  showCumulative?: boolean;
}) {
  const chartData = showCumulative
    ? data.reduce<{ period: string; students: number; cumulativeStudents: number }[]>(
        (rows, row) => [
          ...rows,
          {
            ...row,
            cumulativeStudents:
              (rows[rows.length - 1]?.cumulativeStudents ?? 0) + row.students,
          },
        ],
        [],
      )
    : data;

  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-semibold text-slate-950">Student per Bulan</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} /><Tooltip content={<TooltipBox />} />{showCumulative ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}<Line type="monotone" dataKey="students" name="Jumlah per Bulan" stroke="#0f766e" strokeWidth={3} dot={{ r: 3, fill: "#0f766e" }} activeDot={{ r: 5, fill: "#0f766e" }} />{showCumulative ? <Line type="monotone" dataKey="cumulativeStudents" name="Kumulatif" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5, fill: "#2563eb" }} /> : null}</LineChart></ResponsiveContainer></div></section>;
}

export function StudentRankingChart({
  title,
  data,
  orientation = "horizontal",
}: {
  title: string;
  data: { name: string; students: number }[];
  orientation?: "horizontal" | "vertical";
}) {
  const isVertical = orientation === "vertical";
  const chartHeight = isVertical ? 320 : Math.max(220, data.length * 34 + 36);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isVertical ? "horizontal" : "vertical"}
            margin={{ left: 10, right: 16, bottom: isVertical ? 18 : 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={!isVertical}
              vertical={isVertical}
              stroke="#e2e8f0"
            />
            {isVertical ? (
              <>
                <XAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "#334155", fontSize: 11 }}
                  interval={0}
                  angle={0}
                  textAnchor="middle"
                  height={36}
                />
                <YAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fill: "#334155", fontSize: 11 }}
                />
              </>
            )}
            <Tooltip content={<TooltipBox />} />
            <Bar
              dataKey="students"
              radius={isVertical ? [4, 4, 0, 0] : [0, 4, 4, 0]}
            >
              {data.map((row, index) => (
                <Cell key={row.name} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
