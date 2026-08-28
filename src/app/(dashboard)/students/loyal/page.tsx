import { GraduationCap } from "lucide-react";
import { StudentFilters } from "@/components/student-filters";
import { StudentLoyalTable } from "@/components/student-loyal-table";
import { getStudentOverviewData } from "@/lib/student-data";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const requestedAcademicYear = value("academicYear");
  const data = await getStudentOverviewData({
    academicYear: requestedAcademicYear || undefined,
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
    fromDate: value("fromDate") || undefined,
    toDate: value("toDate") || undefined,
  });
  const academicYear = data.filters.academicYears.includes(requestedAcademicYear) ? requestedAcademicYear : data.filters.academicYears[0] ?? "";
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Students Overview</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Loyal Students</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Summary of unique students, status, branch distribution, and registration trends.</p>
      </header>
      <StudentFilters options={data.filters} showDateFilters={false} values={{ academicYear, branchId: value("branchId"), fromDate: "", toDate: "" }} />
      <StudentLoyalTable rows={data.loyalStudents} />
    </div>
  );
}
