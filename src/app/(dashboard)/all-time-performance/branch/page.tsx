import { GitBranch } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AllTimeBranchPerformancePage() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">All Time Performance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Branch</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Branch performance across the selected career period.</p>
      </header>
      <section className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Branch all-time performance will be available here.
      </section>
    </div>
  );
}
