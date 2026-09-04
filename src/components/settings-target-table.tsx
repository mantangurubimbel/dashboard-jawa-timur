"use client";

import { updateRevenueTarget } from "@/app/(dashboard)/settings/actions";
import type { SettingsTargetData, SettingsTargetKind, SettingsTargetRecord } from "@/lib/settings-target-data";
import { formatCurrency } from "@/lib/format";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

function weekEnd(weekStart: string | null) {
  if (!weekStart) return "-";
  const date = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "-";
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

function EditableTarget({ record }: { record: SettingsTargetRecord }) {
  return (
    <form action={updateRevenueTarget} className="inline-flex items-center justify-end gap-1.5">
      <input type="hidden" name="kind" value={record.kind} />
      <input type="hidden" name="id" value={record.id} />
      <input
        name="target_revenue"
        type="number"
        min="0"
        step="1"
        defaultValue={record.targetRevenue}
        className="h-8 w-32 rounded border border-slate-300 px-2 text-right text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-100"
        aria-label={`Target revenue for ${record.agentName !== "-" ? record.agentName : record.branchName}`}
      />
      <button type="submit" className="h-8 rounded bg-teal-700 px-2 text-xs font-semibold text-white hover:bg-teal-800">Save</button>
    </form>
  );
}

function TableShell({ title, description, children, empty }: { title: string; description: string; children: ReactNode; empty: boolean }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        {empty ? <p className="px-4 py-10 text-center text-sm text-slate-500">No records match the selected filters.</p> : children}
      </div>
    </section>
  );
}

function AnnualTable({ rows }: { rows: SettingsTargetRecord[] }) {
  return (
    <TableShell title="Branch Annual Target" description="Annual branch targets for the active academic year." empty={!rows.length}>
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500"><tr>{["Branch", "Academic Year", "Target Revenue", "Updated"].map((label) => <th key={label} className={`px-3 py-2 font-semibold ${label === "Target Revenue" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-3 py-2 text-slate-700">{row.branchName}</td><td className="px-3 py-2 text-slate-600">{row.academicYear}</td><td className="px-3 py-2 text-right"><EditableTarget record={row} /></td><td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{row.updatedAt.slice(0, 10)}</td></tr>)}</tbody>
      </table>
    </TableShell>
  );
}

function MonthlyTable({ rows }: { rows: SettingsTargetRecord[] }) {
  return (
    <TableShell title="Branch Monthly Target" description="Monthly totals derived from Branch Weekly Target." empty={!rows.length}>
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500"><tr>{["Branch", "Academic Year", "Month", "Target Revenue"].map((label) => <th key={label} className={`px-3 py-2 font-semibold ${label === "Target Revenue" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-3 py-2 text-slate-700">{row.branchName}</td><td className="px-3 py-2 text-slate-600">{row.academicYear}</td><td className="px-3 py-2 text-slate-600">{row.month}</td><td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.targetRevenue)}</td></tr>)}</tbody>
      </table>
    </TableShell>
  );
}

function WeeklyTable({ rows, kind }: { rows: SettingsTargetRecord[]; kind: "branch_weekly" | "agent_weekly" }) {
  const isAgent = kind === "agent_weekly";
  return (
    <TableShell title={isAgent ? "Agent Weekly Target" : "Branch Weekly Target"} description="Weekly targets for the active academic year. Target revenue can be adjusted per week." empty={!rows.length}>
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500"><tr>{[isAgent ? "Agent" : "Branch", "Academic Year", "Month", "Week Start", "Week End", "Target Revenue", "Updated"].map((label) => <th key={label} className={`px-3 py-2 font-semibold ${label === "Target Revenue" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="max-w-52 truncate px-3 py-2 text-slate-700">{isAgent ? row.agentName : row.branchName}</td><td className="px-3 py-2 text-slate-600">{row.academicYear}</td><td className="px-3 py-2 text-slate-600">{row.month}</td><td className="px-3 py-2 text-slate-600">{row.weekStart}</td><td className="px-3 py-2 text-slate-600">{weekEnd(row.weekStart)}</td><td className="px-3 py-2 text-right"><EditableTarget record={row} /></td><td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{row.updatedAt.slice(0, 10)}</td></tr>)}</tbody>
      </table>
    </TableShell>
  );
}

export function SettingsTargetTable({ data }: { data: SettingsTargetData }) {
  const [month, setMonth] = useState(data.latestTransactionMonth ?? "all");
  const [branchId, setBranchId] = useState("all");
  const filtered = useMemo(() => data.records.filter((record) => {
    if (branchId !== "all" && String(record.branchId) !== branchId) return false;
    if (month !== "all" && record.kind !== "annual" && record.month !== month) return false;
    return true;
  }), [branchId, data.records, month]);
  const rowsFor = (kind: SettingsTargetKind) => filtered.filter((record) => record.kind === kind);

  return (
    <div className="grid gap-6">
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Target Management</h2>
            <p className="mt-1 text-sm text-slate-500">Active academic year: <span className="font-semibold text-slate-700">{data.activeAcademicYear ?? "-"}</span>. Monthly targets are derived from weekly branch targets.</p>
          </div>
          <span className="text-xs font-medium text-slate-500">{filtered.length} records</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <select value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700" aria-label="Filter by month">
            <option value="all">All months</option>
            {data.months.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700" aria-label="Filter by branch">
            <option value="all">All branches</option>
            {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AnnualTable rows={rowsFor("annual")} />
        <MonthlyTable rows={rowsFor("monthly")} />
      </div>
      <WeeklyTable rows={rowsFor("branch_weekly")} kind="branch_weekly" />
      <WeeklyTable rows={rowsFor("agent_weekly")} kind="agent_weekly" />
    </div>
  );
}
