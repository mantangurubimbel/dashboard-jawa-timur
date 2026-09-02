import { Banknote, Contact, FileUser, ReplyAll, SquarePercent, TicketPercent, TrendingUp, UsersRound } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { BranchRevenuePerformanceChart } from "@/components/revenue-charts";
import { MonthlyRevenueTable } from "@/components/monthly-revenue-table";
import { RegionalRevenueSourceChart } from "@/components/revenue-charts";
import { StudentRankingChart, StudentTrendChart } from "@/components/student-charts";
import { SummaryTable } from "@/components/summary-table";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getBranchRevenueSummary, getBulkBuyingGrowth, getDashboardData } from "@/lib/local-data";
import { getLatestRevenuePeriodContext } from "@/lib/revenue-filters";
import { getStudentRevenueSummary } from "@/lib/student-data";
import { getDashboardBranchScope } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExecutiveSummaryPage() {
  const branchScope = await getDashboardBranchScope();
  // The AYtD dashboard uses the latest transaction period from t_revenue_txn.
  // The cumulative chart below still receives a separate full-year read.
  const revenuePeriod = await getLatestRevenuePeriodContext(branchScope);
  const revenue = await getDashboardData({
    academicYear: revenuePeriod.academicYear ?? undefined,
    fromDate: revenuePeriod.startDate ?? undefined,
    toDate: revenuePeriod.latestPaymentDate ?? undefined,
  }, branchScope);
  const academicYear = revenue.monthlyRevenueComparison.currentAcademicYear ?? "-";
  // The cumulative chart needs the complete LY curve (through June), while
  // the KPI above intentionally compares only the same AYtD cutoff.
  // These datasets are independent once the academic year is known. Fetch
  // them concurrently so total server time is bounded by the slowest read
  // instead of the sum of every dashboard section.
  const [fullYearRevenue, bulk, students, topBranchRevenue] = await Promise.all([
    getDashboardData({ academicYear }, branchScope),
    revenuePeriod.startDate && revenuePeriod.latestPaymentDate && academicYear !== "-"
      ? getBulkBuyingGrowth(academicYear, revenuePeriod.startDate, revenuePeriod.latestPaymentDate, branchScope)
      : Promise.resolve({ currentRevenue: 0, previousRevenue: 0 }),
    getStudentRevenueSummary(academicYear, branchScope),
    getBranchRevenueSummary(academicYear, branchScope),
  ]);
  const aytdRevenueRows = revenue.monthlyRevenueComparison.rows;
  const revenueRows = aytdRevenueRows.map((row, index) => ({
    ...row,
    previousRevenue: fullYearRevenue.monthlyRevenueComparison.rows[index]?.previousRevenue ?? null,
    previousCumulativeRevenue: fullYearRevenue.monthlyRevenueComparison.rows[index]?.previousCumulativeRevenue ?? null,
  }));
  const actualRevenue = aytdRevenueRows.reduce((total, row) => total + row.currentRevenue, 0);
  const lySamePeriodRevenue = aytdRevenueRows.reduce(
    (total, row) => total + (row.previousRevenue ?? 0),
    0,
  );
  const growthVsLySamePeriod = lySamePeriodRevenue > 0
    ? actualRevenue / lySamePeriodRevenue
    : null;
  const bulkActualRevenue = bulk.currentRevenue;
  const bulkGrowthVsLy = bulk.previousRevenue > 0 ? bulk.currentRevenue / bulk.previousRevenue : null;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Executive Summary</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Executive Summary</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Revenue and student growth summary for academic year {academicYear}.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Revenue" value={formatCurrency(revenue.kpis.totalRevenue)} detail="Retail & bulk buying txn" icon={Banknote} />
        <MetricCard label="Achievement" value={revenue.kpis.achievement === null ? "-" : `${(revenue.kpis.achievement * 100).toFixed(1)}%`} detail="To annual target" icon={TicketPercent} />
        <MetricCard label="Growth Rev vs LY" value={growthVsLySamePeriod === null ? "-" : `${growthVsLySamePeriod.toFixed(2)}x`} detail="AYtD comparison" icon={TrendingUp} />
        <MetricCard label="Rev Bulk Buying" value={formatCurrency(bulkActualRevenue)} detail="Bulk buying txn only" icon={Banknote} />
        <MetricCard label="Growth BB vs LY" value={bulkGrowthVsLy === null ? "-" : `${bulkGrowthVsLy.toFixed(2)}x`} detail="AYtD BB comparison" icon={TrendingUp} />
        <MetricCard label="Total Students" value={formatNumber(students.kpis.totalStudents)} detail="Active & inactive" icon={UsersRound} />
        <MetricCard label="Active Rombel" value={formatNumber(students.kpis.activeRombel)} detail="Unique rombel per branch" icon={Contact} />
        <MetricCard label="Avg Students/Rombel" value={students.kpis.averageStudentsPerRombel.toFixed(1)} detail="15 as target" icon={FileUser} />
        <MetricCard label="Repeat Students" value={formatNumber(students.kpis.repeatStudents)} detail="Loyal students" icon={ReplyAll} />
        <MetricCard label="Renewal Rate" value={`${(students.kpis.renewalRate * 100).toFixed(1)}%`} detail="Repeat/total students" icon={SquarePercent} />
      </section>
      <BranchRevenuePerformanceChart data={revenue.branchRevenuePerformance} academicYear={revenue.monthlyRevenueComparison.currentAcademicYear} />

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <MonthlyRevenueTable
          rows={revenueRows}
          currentAcademicYear={academicYear}
          previousAcademicYear={revenue.monthlyRevenueComparison.previousAcademicYear}
          targetAnnualRevenue={revenue.kpis.targetAnnualRevenue}
          showLastTwoYears={false}
          title="Cumulative Revenue Growth"
          description={`Academic year ${academicYear} & comparison with LY`}
        />
        <RegionalRevenueSourceChart data={revenue.regionalRevenueSource} />
      </section>

      <section className="grid gap-6">
        <StudentTrendChart
          data={students.monthlyData}
          subtitle={`Student growth for ${academicYear} based on payment date.`}
          showCumulative
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <StudentRankingChart title="Students by Level" data={students.levelStudents} orientation="vertical" />
        <StudentRankingChart title="Students by Grade" data={students.gradeStudents} orientation="vertical" />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <SummaryTable
          title="Top Branch by Revenue"
          data={topBranchRevenue.map((row) => ({
            name: row.name,
            revenue: row.revenue,
            transactions: row.newTransactions,
          }))}
          totalRevenue={revenue.kpis.totalRevenue}
          columns="branchRevenue"
        />
        <SummaryTable
          title="Top Branch by Students"
          data={students.branchStudents.slice(0, 8).map((row) => ({
            name: row.name,
            revenue: row.renewalRate,
            transactions: row.students,
          }))}
          totalRevenue={0}
          columns="branchStudents"
        />
        <SummaryTable
          title="Top Agent by New Txn Retail"
          data={revenue.agentPerformance
            .slice()
            .sort((a, b) => b.newTxnNonBulkBuying - a.newTxnNonBulkBuying || a.agent.localeCompare(b.agent))
            .slice(0, 8)
            .map((row) => ({
              name: row.agent,
              revenue: row.revenueNonBulkBuying,
              transactions: row.newTxnNonBulkBuying,
            }))}
          totalRevenue={revenue.kpis.nonBulkRevenue}
          columns="agent"
        />
      </section>
    </div>
  );
}
