"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { BranchRevenuePerformancePoint, MonthlyPoint, RevenueSourcePoint, SummaryPoint } from "@/lib/types";

const palette = ["#0f766e", "#2563eb", "#c2410c", "#7c3aed", "#0f172a", "#be123c"];
const regionalPalette = [
  { retail: "#0f766e", bulk: "#115e59" },
  { retail: "#2563eb", bulk: "#1e40af" },
  { retail: "#c2410c", bulk: "#9a3412" },
  { retail: "#7c3aed", bulk: "#5b21b6" },
  { retail: "#0f172a", bulk: "#020617" },
  { retail: "#be123c", bulk: "#9f1239" },
];

function AxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#64748b" fontSize={11}>
        {payload?.value}
      </text>
    </g>
  );
}

function RegionalAxisTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const words = payload?.value?.split(/\s+/) ?? [];
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > 16 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#334155" fontSize={10}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 12 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function BranchPerformanceBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: BranchRevenuePerformancePoint & { maxValue: number };
}) {
  if (!payload || payload.maxValue <= 0) return null;

  const baseline = y + height;
  const targetHeight = height * (payload.target / payload.maxValue);
  const revenueHeight = height * (payload.revenue / payload.maxValue);

  return (
    <g>
      <rect
        x={x}
        y={baseline - targetHeight}
        width={width}
        height={targetHeight}
        fill="#cbd5e1"
      />
      <rect
        x={x}
        y={baseline - revenueHeight}
        width={width}
        height={revenueHeight}
        fill="#2563eb"
      />
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  totalRevenue,
}: {
  active?: boolean;
  payload?: { payload: SummaryPoint; value: number }[];
  totalRevenue?: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;
  const share = totalRevenue ? point.revenue / totalRevenue : undefined;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-slate-950">{point.name}</p>
      <p className="text-slate-600">{formatCurrency(point.revenue)}</p>
      <p className="text-slate-500">{formatNumber(point.transactions)} transaksi</p>
      {typeof share === "number" ? <p className="text-slate-500">{formatPercent(share)}</p> : null}
    </div>
  );
}

function PieRevenueTooltip({
  active,
  payload,
  totalRevenue,
}: {
  active?: boolean;
  payload?: { payload: SummaryPoint }[];
  totalRevenue?: number;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const share = totalRevenue ? point.revenue / totalRevenue : null;

  return (
    <div className="w-64 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-slate-950">{point.name}</p>
        <span className="whitespace-nowrap text-right text-xs font-semibold text-teal-700">
          {formatCurrency(point.revenue)}
        </span>
      </div>
      <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Transaksi</span>
          <span className="whitespace-nowrap text-right font-semibold text-slate-700">
            {formatNumber(point.transactions)}
          </span>
        </div>
        {share !== null ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">Share</span>
            <span className="whitespace-nowrap text-right font-semibold text-slate-700">
              {formatPercent(share)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MonthlyRevenueChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">Revenue Bulanan</h2>
        <p className="text-sm text-slate-500">Tren transaksi dari Juli 2024 sampai Agustus 2026.</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 18, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" interval={2} tick={<AxisTick />} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0f766e"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: "#0f766e" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function RankingBarChart({
  title,
  description,
  data,
  totalRevenue,
  orientation = "horizontal",
}: {
  title: string;
  description: string;
  data: SummaryPoint[];
  totalRevenue: number;
  orientation?: "horizontal" | "vertical";
}) {
  const isVertical = orientation === "vertical";

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isVertical ? "horizontal" : "vertical"}
            margin={{ left: 12, right: 18, top: 0, bottom: isVertical ? 26 : 0 }}
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
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#334155", fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  tickFormatter={(value) => `${Number(value) / 1_000_000_000}M`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  tickFormatter={(value) => `${Number(value) / 1_000_000_000}M`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#334155", fontSize: 11 }}
                />
              </>
            )}
            <Tooltip content={<ChartTooltip totalRevenue={totalRevenue} />} />
            <Bar dataKey="revenue" radius={isVertical ? [4, 4, 0, 0] : [0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={palette[index % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function RevenueSourceChart({
  data,
  title = "Revenue Source",
  description = "Retail vs Bulk Buying Ratio",
}: {
  data: SummaryPoint[];
  title?: string;
  description?: string;
}) {
  const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              outerRadius="78%"
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieRevenueTooltip totalRevenue={totalRevenue} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-600">
        {data.map((entry, index) => (
          <span key={entry.name} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            {entry.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function RegionalRevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RevenueSourcePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="w-64 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-slate-950">{point.name}</p>
        <span className="text-right text-xs font-semibold text-slate-700">
          {formatCurrency(point.revenue)}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4 text-teal-700">
          <span>Revenue retail</span>
          <span className="text-right">{formatCurrency(point.nonBulkRevenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>Transaksi retail</span>
          <span className="text-right">{formatNumber(point.nonBulkTransactions)}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4 text-blue-700">
          <span>Revenue bulk buying</span>
          <span className="text-right">{formatCurrency(point.bulkRevenue)}</span>
        </div>
      </div>
    </div>
  );
}

export function RegionalRevenueSourceChart({ data }: { data: RevenueSourcePoint[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">Revenue by Regional</h2>
        <p className="text-sm text-slate-500">Revenue retail dan bulk buying per regional.</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 8, right: 18, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              interval={0}
              height={72}
              tick={<RegionalAxisTick />}
            />
            <YAxis hide />
            <Tooltip content={<RegionalRevenueTooltip />} />
            <Bar dataKey="nonBulkRevenue" name="Retail" stackId="revenue">
              {data.map((entry, index) => (
                <Cell
                  key={`retail-${entry.name}`}
                  fill={regionalPalette[index % regionalPalette.length].retail}
                />
              ))}
            </Bar>
            <Bar dataKey="bulkRevenue" name="Bulk Buying" stackId="revenue">
              {data.map((entry, index) => (
                <Cell
                  key={`bulk-${entry.name}`}
                  fill={regionalPalette[index % regionalPalette.length].bulk}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function BranchRevenuePerformanceChart({
  data,
  academicYear,
}: {
  data: BranchRevenuePerformancePoint[];
  academicYear: string | null;
}) {
  const overlayData = data.map((point) => ({
    ...point,
    maxValue: Math.max(point.target, point.revenue),
  }));

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">Branch Revenue Performance</h2>
        <p className="text-sm text-slate-500">Branch revenue vs annual target {academicYear ?? "-"}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={overlayData}
            margin={{ left: 8, right: 18, bottom: 45 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={72}
              tick={{ fill: "#334155", fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value) => `${Number(value) / 1_000_000_000}M`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#e2e8f0", fillOpacity: 0.55 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as BranchRevenuePerformancePoint;
                return (
                  <div className="w-64 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-slate-950">{point.name}</p>
                      <span className="whitespace-nowrap text-right text-xs font-semibold text-blue-700">
                        {formatCurrency(point.revenue)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-600">Target</span>
                      <span className="whitespace-nowrap text-right font-semibold text-slate-700">
                        {formatCurrency(point.target)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4 text-xs">
                      <span className="text-slate-600">Achievement</span>
                      <span className="whitespace-nowrap text-right font-semibold text-slate-700">
                        {point.target > 0
                          ? `${((point.revenue / point.target) * 100).toFixed(1)}%`
                          : "-"}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="maxValue"
              name="Revenue vs Target"
              fill="#94a3b8"
              barSize={22}
              shape={<BranchPerformanceBar />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
