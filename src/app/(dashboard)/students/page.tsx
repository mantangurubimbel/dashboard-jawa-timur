import { GraduationCap, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { StudentFilters } from "@/components/student-filters";
import { StudentRankingChart, StudentTrendChart } from "@/components/student-charts";
import { StudentBranchSummary } from "@/components/student-branch-summary";
import { StudentWeeklyTable } from "@/components/student-weekly-table";
import { getStudentOverviewData } from "@/lib/student-data";
import { formatNumber } from "@/lib/format";

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
  const data = await getStudentOverviewData({
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
    fromDate: value("fromDate") || undefined,
    toDate: value("toDate") || undefined,
  });
  const academicYear = data.filters.academicYears[0] ?? "";

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Students Overview</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Student Growth</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Summary of unique students, status, branch distribution, and registration trends for academic year {academicYear || "-"}.
        </p>
      </header>
      <StudentFilters
        options={data.filters}
        values={{
          branchId: value("branchId"),
          fromDate: value("fromDate"),
          toDate: value("toDate"),
        }}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Students" value={formatNumber(data.kpis.totalStudents)} detail="Unique NIS" icon={UsersRound} />
        <MetricCard label="Active Rombel" value={formatNumber(data.kpis.activeRombel)} detail="Unique rombel per branch" icon={UserCheck} />
        <MetricCard label="Avg Students/Rombel" value={data.kpis.averageStudentsPerRombel.toFixed(1)} detail="Total students/active rombel" icon={UserPlus} />
        <MetricCard label="Repeat Students" value={formatNumber(data.kpis.repeatStudents)} detail="Appears more than once" icon={UsersRound} />
        <MetricCard label="Renewal Rate" value={`${(data.kpis.renewalRate * 100).toFixed(1)}%`} detail="Repeat students/total students" icon={UserCheck} />
      </section>
      <section className="grid gap-6">
        <StudentTrendChart data={data.monthlyStudents} showComparisons />
      </section>
      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <StudentRankingChart title="Students by Grade" data={data.gradeStudents} orientation="vertical" />
        <StudentRankingChart title="Students by Level" data={data.levelStudents} orientation="vertical" />
      </section>
      <StudentBranchSummary rows={data.branchSummary} />
      <StudentWeeklyTable
        weeks={data.weeklyStudentAdds.weeks}
        rows={data.weeklyStudentAdds.rows}
      />
    </div>
  );
}
