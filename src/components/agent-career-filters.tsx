"use client";

import { Filter, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { AgentCareerMonth } from "@/lib/agent-career-data";

export function AgentCareerFilters({
  agents,
  months,
  values,
}: {
  agents: { id: string; label: string }[];
  months: AgentCareerMonth[];
  values: { agentId: string; fromMonth: string; toMonth: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(values);
  const fromMonthIndex = months.findIndex((month) => month.id === draft.fromMonth);
  const toMonthOptions = fromMonthIndex >= 0 ? months.slice(fromMonthIndex) : months;

  function update(key: keyof typeof draft, value: string) {
    const next = { ...draft, [key]: value };
    if (key === "fromMonth" && value) {
      const nextFromIndex = months.findIndex((month) => month.id === value);
      const currentToIndex = months.findIndex((month) => month.id === next.toMonth);
      if (nextFromIndex >= 0 && currentToIndex >= 0 && currentToIndex < nextFromIndex) {
        next.toMonth = "";
      }
    }
    setDraft(next);
    const params = new URLSearchParams(searchParams.toString());
    for (const [name, currentValue] of Object.entries(next)) {
      if (currentValue) params.set(name, currentValue);
      else params.delete(name);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function reset() {
    setDraft({ agentId: "", fromMonth: "", toMonth: "" });
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-teal-700" aria-hidden />
          <span className="text-sm font-semibold text-slate-950">Agent Career Filters</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={draft.agentId}
            onChange={(event) => update("agentId", event.target.value)}
            aria-label="Agent"
            className="h-8 w-48 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">Select agent</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
          <select
            value={draft.fromMonth}
            onChange={(event) => update("fromMonth", event.target.value)}
            aria-label="From month"
            className="h-8 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">From month</option>
            {months.map((month) => <option key={month.id} value={month.id}>{month.label}</option>)}
          </select>
          <select
            value={draft.toMonth}
            onChange={(event) => update("toMonth", event.target.value)}
            aria-label="To month"
            className="h-8 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">To month</option>
            {toMonthOptions.map((month) => <option key={month.id} value={month.id}>{month.label}</option>)}
          </select>
          {pending ? <span className="text-xs text-slate-400">Loading...</span> : null}
          <button type="button" onClick={reset} disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset
          </button>
        </div>
      </div>
    </section>
  );
}
