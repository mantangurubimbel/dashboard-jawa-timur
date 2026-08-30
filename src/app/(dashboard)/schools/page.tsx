import { Building2 } from "lucide-react";
import { SchoolFilters } from "@/components/school-filters";
import { SchoolAccountsTable } from "@/components/school-accounts-table";
import { getSchoolAnalytics } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getLatestRevenuePeriodContext } from "@/lib/revenue-filters";
import { getDashboardBranchScope } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const branchScope = await getDashboardBranchScope();
  const periodContext = await getLatestRevenuePeriodContext(branchScope);
  const academicYear = periodContext.academicYear ?? "";
  const [rows, bulkRows] = await Promise.all([
    getSchoolAnalytics({
      academicYear,
      level: value("level"),
      isBulkBuying: null,
    }, branchScope),
    getSchoolAnalytics({
      academicYear,
      level: value("level"),
      isBulkBuying: true,
    }, branchScope),
  ]);
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">School Partner</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">By Revenue</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          School ranking by total transaction revenue for academic year {academicYear || "-"}.
        </p>
      </header>
      <SchoolFilters
        values={{ level: value("level") }}
      />
      <SchoolAccountsTable rows={rows} />
      <SchoolAccountsTable
        rows={bulkRows}
        title="Top Bulk Buying Revenue Contributors"
        subtitle="Schools with the highest bulk buying sales"
      />
      <p className="text-xs text-slate-500">
        {formatNumber(rows.length)} schools have a mapped NPSN for the selected filters.
      </p>
    </div>
  );
}
