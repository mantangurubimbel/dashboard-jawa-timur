"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { MonthlyComparisonPoint } from "@/lib/types";

function formatRevenueAxis(value: number) {
  return value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(1)}M`
    : `${(value / 1_000_000).toFixed(0)}jt`;
}

type MonthlyRevenueChartProps = {
  rows: MonthlyComparisonPoint[];
  currentAcademicYear: string | null;
  previousAcademicYear: string | null;
  targetAnnualRevenue?: number;
  cumulative?: boolean;
  monthlyBars?: boolean;
  showLastTwoYears?: boolean;
  title?: string;
  description?: string;
};

function ComparisonTooltip({
  active,
  payload,
  currentAcademicYear,
  targetAnnualRevenue,
  cumulative,
  showLastTwoYears,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: MonthlyComparisonPoint }[];
  currentAcademicYear: string | null;
  targetAnnualRevenue?: number;
  cumulative: boolean;
  showLastTwoYears: boolean;
}) {
  if (!active || !payload?.length || !payload[0].payload) {
    return null;
  }

  const row = payload[0].payload;
  const currentRevenue = cumulative
    ? row.currentCumulativeRevenue
    : row.currentRevenue;
  const previousRevenue = cumulative
    ? row.previousCumulativeRevenue
    : row.previousRevenue;
  const lastTwoYearsRevenue = cumulative
    ? row.lastTwoYearsCumulativeRevenue
    : row.lastTwoYearsRevenue;
  const targetRevenue = cumulative
    ? targetAnnualRevenue ?? row.targetCumulativeRevenue
    : row.targetRevenue;
  const growthVsLy =
    previousRevenue !== null && previousRevenue > 0
      ? currentRevenue / previousRevenue
      : null;
  const growthVsL2y =
    lastTwoYearsRevenue !== null &&
    lastTwoYearsRevenue > 0
      ? currentRevenue / lastTwoYearsRevenue
      : null;
  const achievement =
    targetRevenue !== null && targetRevenue > 0
      ? currentRevenue / targetRevenue
      : null;

  return (
    <div className="w-72 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{row.month}</p>
      <div className="mt-3 flex items-center justify-between gap-4 font-semibold text-teal-700">
        <span>Revenue {currentAcademicYear ?? "aktif"}</span>
        <span className="text-right">{formatCurrency(currentRevenue)}</span>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {previousRevenue !== null ? (
          <div className="flex items-center justify-between gap-4 text-blue-700">
            <span>Revenue LY</span>
            <span className="text-right">{formatCurrency(previousRevenue)}</span>
          </div>
        ) : null}
        {showLastTwoYears && lastTwoYearsRevenue !== null ? (
          <div className="flex items-center justify-between gap-4 text-slate-600">
            <span>Revenue L2Y</span>
            <span className="text-right">{formatCurrency(lastTwoYearsRevenue)}</span>
          </div>
        ) : null}
        {targetRevenue !== null ? (
          <div className="flex items-center justify-between gap-4 text-slate-950">
            <span>Target</span>
            <span className="text-right">{formatCurrency(targetRevenue)}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {previousRevenue !== null ? (
          <div className={`flex items-center justify-between gap-4 ${growthVsLy !== null && growthVsLy >= 1 ? "text-emerald-700" : "text-rose-700"}`}>
            <span>Growth vs LY</span>
            <span className="text-right">{growthVsLy === null ? "-" : `${growthVsLy.toFixed(2)}x`}</span>
          </div>
        ) : null}
        {showLastTwoYears && lastTwoYearsRevenue !== null ? (
          <div className={`flex items-center justify-between gap-4 ${growthVsL2y !== null && growthVsL2y >= 1 ? "text-emerald-700" : "text-rose-700"}`}>
            <span>Growth vs L2Y</span>
            <span className="text-right">{growthVsL2y === null ? "-" : `${growthVsL2y.toFixed(2)}x`}</span>
          </div>
        ) : null}
        {targetRevenue !== null ? (
          <div className={`flex items-center justify-between gap-4 ${achievement !== null && achievement >= 1 ? "text-emerald-700" : "text-rose-700"}`}>
            <span>Achievement</span>
            <span className="text-right">{achievement === null ? "-" : `${(achievement * 100).toFixed(1)}%`}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MonthlyRevenueTable({
  rows,
  currentAcademicYear,
  previousAcademicYear,
  targetAnnualRevenue,
  cumulative = true,
  monthlyBars = false,
  showLastTwoYears = true,
  title,
  description,
}: MonthlyRevenueChartProps) {
  const comparisonEnabled = Boolean(currentAcademicYear && previousAcademicYear);
  const targetEnabled = rows.some((row) =>
    cumulative
      ? targetAnnualRevenue !== undefined || row.targetCumulativeRevenue !== null
      : row.targetRevenue !== null,
  );
  const currentDataKey = cumulative ? "currentCumulativeRevenue" : "currentRevenue";
  const previousDataKey = cumulative
    ? "previousCumulativeRevenue"
    : "previousRevenue";
  const lastTwoYearsDataKey = cumulative
    ? "lastTwoYearsCumulativeRevenue"
    : "lastTwoYearsRevenue";
  const targetDataKey = cumulative ? "targetCumulativeRevenue" : "targetRevenue";
  const chartRows =
    cumulative && targetAnnualRevenue !== undefined
      ? rows.map((row) => ({
          ...row,
          targetCumulativeRevenue: targetAnnualRevenue,
        }))
      : rows;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {title ?? (cumulative ? "Revenue Kumulatif" : "Revenue Bulanan")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {description ?? (comparisonEnabled
              ? `${cumulative ? "Kumulatif" : "Bulanan"} revenue ${currentAcademicYear} vs LY.`
              : `${cumulative ? "Kumulatif" : "Bulanan"} revenue berdasarkan filter aktif.`)}
          </p>
        </div>
        {!comparisonEnabled ? (
          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            Pilih Academic Year untuk membandingkan
          </span>
        ) : null}
      </div>

      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ left: 8, right: 18, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => formatRevenueAxis(Number(value))}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis-muted)", fontSize: 11 }}
            />
            <Tooltip
              content={
                <ComparisonTooltip
                  currentAcademicYear={currentAcademicYear}
                  targetAnnualRevenue={targetAnnualRevenue}
                  cumulative={cumulative}
                  showLastTwoYears={showLastTwoYears}
                />
              }
            />
            {comparisonEnabled ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
            {monthlyBars && !cumulative ? (
              <>
                <Bar dataKey={currentDataKey} name={currentAcademicYear ?? "Revenue"} fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey={currentDataKey}
                name={currentAcademicYear ?? "Revenue"}
                stroke="var(--chart-primary)"
                strokeWidth={3}
                dot={{ r: 3, fill: "var(--chart-primary)" }}
                activeDot={{ r: 5 }}
              />
            )}
            {comparisonEnabled ? (
              monthlyBars && !cumulative ? (
                <Bar dataKey={previousDataKey} name="LY" fill="var(--chart-secondary)" radius={[4, 4, 0, 0]} />
              ) : (
                <Line
                  type="monotone"
                  dataKey={previousDataKey}
                  name="LY"
                  stroke="var(--chart-secondary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--chart-secondary)" }}
                  activeDot={{ r: 5 }}
                />
              )
            ) : null}
            {comparisonEnabled && showLastTwoYears ? (
              monthlyBars && !cumulative ? (
                <Bar dataKey={lastTwoYearsDataKey} name="L2Y" fill="var(--chart-axis-muted)" radius={[4, 4, 0, 0]} />
              ) : (
                <Line
                  type="monotone"
                  dataKey={lastTwoYearsDataKey}
                  name="L2Y"
                  stroke="var(--chart-axis-muted)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2, fill: "var(--chart-axis-muted)" }}
                  activeDot={{ r: 4 }}
                />
              )
            ) : null}
            {targetEnabled ? (
              <Line
                type="monotone"
                dataKey={targetDataKey}
                name="Target"
                stroke="var(--chart-fifth)"
                strokeWidth={2}
                strokeDasharray="8 5"
                dot={{ r: 2, fill: "var(--chart-fifth)" }}
                activeDot={{ r: 4 }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
