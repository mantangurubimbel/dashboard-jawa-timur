import { Building2 } from "lucide-react";
import { SchoolFilters } from "@/components/school-filters";
import { SchoolAccountsTable } from "@/components/school-accounts-table";
import { getSchoolAnalytics } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";

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
  const academicYears = await getRevenueAcademicYearOptions();
  const academicYear = academicYears.some((year) => year.id === value("academicYear"))
    ? value("academicYear")
    : academicYears[0]?.id ?? "";
  const [rows, bulkRows] = await Promise.all([
    getSchoolAnalytics({
      academicYear,
      level: value("level"),
      isBulkBuying: null,
    }),
    getSchoolAnalytics({
      academicYear,
      level: value("level"),
      isBulkBuying: true,
    }),
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
        <p className="mt-2 text-sm text-slate-600">Ranking sekolah berdasarkan total revenue transaksi.</p>
      </header>
      <SchoolFilters
        academicYears={academicYears.map((year) => year.id)}
        values={{ academicYear, level: value("level") }}
      />
      <SchoolAccountsTable rows={rows} />
      <SchoolAccountsTable
        rows={bulkRows}
        title="Kontributor Revenue Bulk Buying"
        subtitle="Rangking sekolah dengan penjualan bulk buying tertinggi"
      />
      <p className="text-xs text-slate-500">
        {formatNumber(rows.length)} sekolah memiliki NPSN terpetakan sesuai filter.
      </p>
    </div>
  );
}
