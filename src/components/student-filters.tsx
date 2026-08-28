"use client";

import { Filter, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Branch = { id: string; label: string };

export function StudentFilters({
  options,
  values,
  showDateFilters = true,
}: {
  options: {
    academicYears: string[];
    branches: Branch[];
  };
  values: {
    academicYear: string;
    branchId: string;
    fromDate: string;
    toDate: string;
  };
  showDateFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(values);

  function update(key: keyof typeof draft, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([name, currentValue]) => {
      if (currentValue) params.set(name, currentValue);
      else params.delete(name);
    });
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function reset() {
    setDraft({
      academicYear: "",
      branchId: "",
      fromDate: "",
      toDate: "",
    });
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-teal-700" aria-hidden />
          <span className="text-sm font-semibold text-slate-950">Student Filters</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select value={draft.academicYear} onChange={(event) => update("academicYear", event.target.value)} aria-label="Academic Year" className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800">
            {options.academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={draft.branchId} onChange={(event) => update("branchId", event.target.value)} aria-label="Branch" className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800">
            <option value="">All branches</option>
            {options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
          </select>
          {showDateFilters ? <><label className="flex items-center gap-1.5"><span className="text-xs text-slate-500">From date</span><input type="date" value={draft.fromDate} onChange={(event) => update("fromDate", event.target.value)} className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800" /></label><label className="flex items-center gap-1.5"><span className="text-xs text-slate-500">To date</span><input type="date" value={draft.toDate} onChange={(event) => update("toDate", event.target.value)} className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800" /></label></> : null}
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50"
            title="Reset filter"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
          {pending ? <span className="text-xs text-slate-400">Loading...</span> : null}
        </div>
      </div>
    </section>
  );
}
