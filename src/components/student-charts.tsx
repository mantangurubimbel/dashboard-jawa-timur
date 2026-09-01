"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

const colors = [
  "var(--chart-primary)",
  "var(--chart-secondary)",
  "var(--chart-tertiary)",
  "var(--chart-quaternary)",
  "var(--chart-sixth)",
  "var(--chart-fifth)",
];

type StudentTrendPoint = {
  period: string;
  students: number;
  cumulativeStudents?: number;
  lySamePeriod?: number;
  l2ySamePeriod?: number;
  lyStudents?: number;
  l2yStudents?: number;
};

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
      lyStudents?: number;
      l2yStudents?: number;
    };
  }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const isMonthlyComparisonPoint = point.lyStudents !== undefined || point.l2yStudents !== undefined;
  const isComparisonPoint = isMonthlyComparisonPoint ||
    (point.lySamePeriod !== undefined && point.l2ySamePeriod !== undefined);
  const lySamePeriod = isMonthlyComparisonPoint
    ? point.lyStudents ?? 0
    : point.lySamePeriod ?? 0;
  const l2ySamePeriod = isMonthlyComparisonPoint
    ? point.l2yStudents ?? 0
    : point.l2ySamePeriod ?? 0;
  const lyGrowth = lySamePeriod > 0 ? point.students / lySamePeriod : null;
  const l2yGrowth = l2ySamePeriod > 0 ? point.students / l2ySamePeriod : null;

  return (
    <div className="w-56 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{point.name ?? point.period}</p>
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between gap-4 font-semibold text-teal-700">
          <span>{isComparisonPoint ? "Student Count" : "Student"}</span>
          <span className="text-right">{formatNumber(point.students)}</span>
        </div>
        {isMonthlyComparisonPoint ? (
          <>
            <div className="flex items-center justify-between gap-4 text-xs text-blue-700">
              <span>Students LY</span>
              <span className="text-right">{formatNumber(lySamePeriod)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
              <span>Students L2Y</span>
              <span className="text-right">{formatNumber(l2ySamePeriod)}</span>
            </div>
          </>
        ) : null}
        {point.cumulativeStudents !== undefined ? (
          <div className="flex items-center justify-between gap-4 text-xs text-blue-700">
            <span>Cumulative</span>
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
  subtitle = "Student count by payment date.",
  showCumulative = false,
  showComparisons = false,
}: {
  data: StudentTrendPoint[];
  subtitle?: string;
  showCumulative?: boolean;
  showComparisons?: boolean;
}) {
  const chartData = showCumulative
    ? data.reduce<StudentTrendPoint[]>(
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
  const hasComparisons = showComparisons && chartData.some(
    (point) => point.lyStudents !== undefined || point.l2yStudents !== undefined,
  );

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Students by Month</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="student-trend-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="student-trend-cumulative-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-secondary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--chart-secondary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="period" tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }} />
            <Tooltip content={<TooltipBox />} />
            {showCumulative || hasComparisons ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
            <Area
              type="monotone"
              dataKey="students"
              name="Students by Month"
              stroke="var(--chart-primary)"
              strokeWidth={3}
              fill="url(#student-trend-area-gradient)"
              dot={{ r: 3, fill: "var(--chart-primary)" }}
              activeDot={{ r: 5, fill: "var(--chart-primary)" }}
            />
            {hasComparisons ? (
              <>
                <Area
                  type="monotone"
                  dataKey="lyStudents"
                  name="LY"
                  stroke="var(--chart-secondary)"
                  strokeWidth={2.5}
                  fill="none"
                  dot={{ r: 3, fill: "var(--chart-secondary)" }}
                  activeDot={{ r: 5, fill: "var(--chart-secondary)" }}
                />
                <Area
                  type="monotone"
                  dataKey="l2yStudents"
                  name="L2Y"
                  stroke="var(--chart-tertiary)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="none"
                  dot={{ r: 3, fill: "var(--chart-tertiary)" }}
                  activeDot={{ r: 5, fill: "var(--chart-tertiary)" }}
                />
              </>
            ) : null}
            {showCumulative ? (
              <Area
                type="monotone"
                dataKey="cumulativeStudents"
                name="Cumulative"
                stroke="var(--chart-secondary)"
                strokeWidth={2.5}
                fill="url(#student-trend-cumulative-gradient)"
                dot={{ r: 3, fill: "var(--chart-secondary)" }}
                activeDot={{ r: 5, fill: "var(--chart-secondary)" }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
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
              stroke="var(--chart-grid)"
            />
            {isVertical ? (
              <>
                <XAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  interval={0}
                  angle={0}
                  textAnchor="middle"
                  height={36}
                />
                <YAxis type="number" tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis type="number" tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
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
