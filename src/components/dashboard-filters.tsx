"use client";

import { Filter, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BranchFilterOption, FilterOption } from "@/lib/types";

type DashboardFiltersProps = {
  options: {
    academicYears: FilterOption[];
    regions: FilterOption[];
    branches: BranchFilterOption[];
    months: FilterOption[];
  };
  values: {
    academicYear: string;
    regionId: string;
    branchId: string;
    month: string;
    fromDate: string;
    toDate: string;
  };
  showDateFilters?: boolean;
};

export function DashboardFilters({ options, values, showDateFilters = true }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draftValues, setDraftValues] = useState(values);

  function replaceFilters(nextValues: typeof values) {
    setDraftValues(nextValues);
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(nextValues)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function updateFilter(key: keyof typeof values, value: string) {
    const nextValues = { ...draftValues, [key]: value };

    if (key === "regionId" && value && nextValues.branchId) {
      const selectedBranch = options.branches.find(
        (branch) => branch.id === nextValues.branchId,
      );

      if (selectedBranch && selectedBranch.regionId !== value) {
        nextValues.branchId = "";
      }
    }

    if (key === "branchId" && value) {
      const selectedBranch = options.branches.find((branch) => branch.id === value);
      if (selectedBranch) {
        nextValues.regionId = selectedBranch.regionId;
      }
    }

    replaceFilters(nextValues);
  }

  function resetFilters() {
    setDraftValues({
      academicYear: "",
      regionId: "",
      branchId: "",
      month: "",
      fromDate: "",
      toDate: "",
    });
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-teal-700" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-slate-950">Filter Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5">
            <select
              value={draftValues.academicYear}
              onChange={(event) => updateFilter("academicYear", event.target.value)}
              className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              {options.academicYears.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <select
              value={draftValues.regionId}
              onChange={(event) => updateFilter("regionId", event.target.value)}
              className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Semua regional</option>
              {options.regions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <select
              value={draftValues.branchId}
              onChange={(event) => updateFilter("branchId", event.target.value)}
              className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Semua branch</option>
              {options.branches
                .filter(
                  (option) =>
                    !draftValues.regionId || option.regionId === draftValues.regionId,
                )
                .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <select
              value={draftValues.month}
              onChange={(event) => updateFilter("month", event.target.value)}
              className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Semua bulan</option>
              {options.months.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          {showDateFilters ? <label className="block">
            <span className="text-xs font-semibold text-slate-500">Dari tanggal</span>
            <input
              type="date"
              value={draftValues.fromDate}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label> : null}
          <button type="button" onClick={resetFilters} disabled={isPending} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset</button>
          {showDateFilters ? <label className="block">
            <span className="text-xs font-semibold text-slate-500">Sampai tanggal</span>
            <input
              type="date"
              value={draftValues.toDate}
              onChange={(event) => updateFilter("toDate", event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label> : null}
          {isPending ? (
            <div className="flex items-end text-xs text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-6">
              Memuat data terbaru...
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
