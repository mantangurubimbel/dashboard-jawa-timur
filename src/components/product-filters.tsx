"use client";

import { Filter, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Region = { id: string; label: string };
type Branch = { id: string; label: string; regionId: string };

export function ProductFilters({
  branches,
  regions,
  months,
  values,
}: {
  branches: Branch[];
  regions: Region[];
  months: string[];
  values: {
    regionId: string;
    branchId: string;
    month: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(values);

  function update(key: keyof typeof draft, value: string) {
    const next = { ...draft, [key]: value };
    if (key === "regionId" && value && next.branchId) {
      const branch = branches.find((item) => item.id === next.branchId);
      if (branch && branch.regionId !== value) next.branchId = "";
    }
    if (key === "branchId" && value) {
      const branch = branches.find((item) => item.id === value);
      if (branch) next.regionId = branch.regionId;
    }
    setDraft(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("academicYear");
    params.delete("fromDate");
    params.delete("toDate");

    for (const [name, currentValue] of Object.entries(next)) {
      if (currentValue) params.set(name, currentValue);
      else params.delete(name);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }
  function reset() {
    setDraft({ regionId: "", branchId: "", month: "" });
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-teal-700" aria-hidden />
          <span className="text-sm font-semibold text-slate-950">Product Filters</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={draft.regionId}
            onChange={(event) => update("regionId", event.target.value)}
            aria-label="Region"
            className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All regions</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
          </select>
          <select
            value={draft.branchId}
            onChange={(event) => update("branchId", event.target.value)}
            aria-label="Branch"
            className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All branches</option>
            {branches.filter((branch) => !draft.regionId || branch.regionId === draft.regionId).map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
          </select>
          <select
            value={draft.month}
            onChange={(event) => update("month", event.target.value)}
            aria-label="Month"
            className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All months</option>
            {months.map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
          {pending ? <span className="text-xs text-slate-400">Loading...</span> : null}
          <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
        </div>
      </div>
    </section>
  );
}
