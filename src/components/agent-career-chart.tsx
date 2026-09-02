"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgentCareerWeeklyRow } from "@/lib/agent-career-data";
import { formatCurrency, formatPercent } from "@/lib/format";

function CareerTooltip({ active, payload }: { active?: boolean; payload?: { payload: AgentCareerWeeklyRow }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="w-64 rounded-md border border-slate-200 bg-white px-3 py-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-950">Week of {point.weekStart}</p>
      <p className="mt-0.5 text-slate-500">{point.month} · {point.branch}</p>
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        <div className="flex justify-between gap-3"><span className="text-slate-600">Target</span><span className="font-semibold text-slate-800">{formatCurrency(point.target)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-600">Revenue</span><span className="font-semibold text-teal-700">{formatCurrency(point.revenue)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-600">Revenue to target</span><span className={point.achievement !== null && point.achievement >= 1 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{point.achievement === null ? "-" : formatPercent(point.achievement)}</span></div>
      </div>
    </div>
  );
}

export function AgentCareerChart({ rows }: { rows: AgentCareerWeeklyRow[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">Weekly Target vs Revenue</h2>
        <p className="text-sm text-slate-500">Non-bulk buying revenue by Monday–Sunday week.</p>
      </div>
      <div className="h-80">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ left: 8, right: 18, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="agent-career-revenue-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="agent-career-target-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-target)" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="var(--chart-target)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="weekStart" interval="preserveStartEnd" tick={{ fill: "var(--chart-axis-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CareerTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="target" name="Weekly Target" stroke="var(--chart-target)" fill="url(#agent-career-target-gradient)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="revenue" name="Actual Revenue" stroke="var(--chart-primary)" fill="url(#agent-career-revenue-gradient)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "var(--chart-primary)" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">Select an agent to view weekly performance.</div>}
      </div>
    </section>
  );
}
