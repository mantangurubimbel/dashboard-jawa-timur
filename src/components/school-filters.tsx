"use client";

import { Filter, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const levels = ["SD", "SMP", "SMA"];

export function SchoolFilters({
  academicYears,
  values,
}: {
  academicYears: string[];
  values: { academicYear: string; level: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(values);

  function update(key: "academicYear" | "level", value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.academicYear) params.set("academicYear", next.academicYear);
    else params.delete("academicYear");
    if (next.level) params.set("level", next.level);
    else params.delete("level");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }
  function reset() { setDraft({ academicYear: "", level: "" }); startTransition(() => router.replace(pathname, { scroll: false })); }

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-teal-700" aria-hidden />
          <span className="text-sm font-semibold text-slate-950">School Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={draft.academicYear}
            onChange={(event) => update("academicYear", event.target.value)}
            aria-label="Academic Year"
            className="h-8 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All academic years</option>
            {academicYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={draft.level}
            onChange={(event) => update("level", event.target.value)}
            aria-label="Level"
            className="h-8 w-28 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">All levels</option>
            {levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          {pending ? <span className="text-[11px] text-slate-400">Loading...</span> : null}
          <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
        </div>
      </div>
    </section>
  );
}
