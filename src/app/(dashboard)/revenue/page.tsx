import {
  Banknote,
  Users,
  ReceiptText,
} from "lucide-react";
import { DashboardFilters } from "@/components/dashboard-filters";
import { ImportRevenueTargetButton } from "@/components/import-revenue-target-button";
import { MetricCard } from "@/components/metric-card";
import {
  BranchRevenuePerformanceChart,
  RankingBarChart,
  RegionalRevenueSourceChart,
  RevenueSourceChart,
} from "@/components/revenue-charts";
import { MonthlyRevenueTable } from "@/components/monthly-revenue-table";
import { UploadRawDataButton } from "@/components/upload-raw-data-button";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  getBranchRevenuePerformance,
  getDashboardData,
  getRevenueGrowthSameDate,
} from "@/lib/local-data";
import { getDashboardBranchScope } from "@/lib/dashboard-access";
import { getLatestRevenuePeriodContext } from "@/lib/revenue-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function RevenuePageContent({
  searchParams,
  showDataActions = false,
  eyebrow = "Revenue Overview",
  title = "Branch Performance",
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  showDataActions?: boolean;
  eyebrow?: string;
  title?: string;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const numericValue = (key: string) => {
    const raw = value(key);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const branchScope = await getDashboardBranchScope();
  const periodContext = await getLatestRevenuePeriodContext(branchScope);
  const requestedMonth = value("month");
  const selectedMonth = periodContext.months.some((option) => option.id === requestedMonth)
    ? requestedMonth ?? ""
    : "";
  const dashboardFilters = {
    academicYear: periodContext.academicYear ?? undefined,
    regionId: numericValue("regionId"),
    branchId: numericValue("branchId"),
    month: selectedMonth || undefined,
  };
  const [data, sameDateGrowth] = await Promise.all([
    getDashboardData(dashboardFilters, branchScope),
    getRevenueGrowthSameDate(dashboardFilters, branchScope),
  ]);
  const branchPerformance = await getBranchRevenuePerformance(
    data.monthlyRevenueComparison.currentAcademicYear ?? "",
    numericValue("regionId"),
    numericValue("branchId"),
    selectedMonth || undefined,
    branchScope,
  );
  const { kpis } = data;
  const selectedMonthTarget = showDataActions && selectedMonth
    ? data.monthlyRevenueComparison.rows.find((row) => row.month === selectedMonth)?.targetRevenue ?? 0
    : kpis.targetAnnualRevenue;
  const targetLabel = showDataActions && selectedMonth ? "Target" : "Annual Target";
  const achievementValue =
    showDataActions && selectedMonth
      ? selectedMonthTarget > 0
        ? kpis.totalRevenue / selectedMonthTarget
        : null
      : kpis.achievement;
  const revenueSourceData = data.paymentCategoryRevenue.reduce((summary, row) => {
    if (row.name === "Bulk Buying") {
      summary.push({ name: "Bulk Buying", revenue: row.revenue, transactions: row.transactions });
    }
    return summary;
  }, [{
    name: "Retail",
    revenue: kpis.nonBulkRevenue,
    transactions: data.paymentCategoryRevenue
      .filter((row) => row.name === "New Txn / Down Payment")
      .reduce((sum, row) => sum + row.transactions, 0),
  }] as { name: string; revenue: number; transactions: number }[]);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className={`flex flex-col gap-4 border-b border-slate-200 pb-5 ${showDataActions ? "xl:flex-row xl:items-end xl:justify-between" : ""}`}>
        <div>
          <p className="text-sm font-semibold uppercase text-teal-700">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Revenue summary for academic year {data.monthlyRevenueComparison.currentAcademicYear ?? "-"}.
          </p>
        </div>
        {showDataActions ? (
          <div className="flex flex-wrap gap-2">
            <UploadRawDataButton />
            <ImportRevenueTargetButton />
          </div>
        ) : null}
      </header>
      <>
        <DashboardFilters
          showDateFilters={false}
          key={JSON.stringify(params)}
          options={{ ...data.filters, months: periodContext.months }}
          values={{
            regionId: value("regionId") ?? "",
            branchId: value("branchId") ?? "",
            month: selectedMonth,
            fromDate: "",
            toDate: "",
          }}
        />
      </>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Actual Revenue" value={formatCurrency(kpis.totalRevenue)} detail={`${formatNumber(kpis.totalTransactions)} transactions`} icon={Banknote} />
        <MetricCard label={targetLabel} value={formatCurrency(selectedMonthTarget)} detail={selectedMonth ? `Monthly target ${selectedMonth}` : "Total branch target"} icon={Banknote} />
        <MetricCard label="Achievement" value={achievementValue === null ? "-" : `${(achievementValue * 100).toFixed(1)}%`} detail={`Variance ${formatCurrency(kpis.totalRevenue - selectedMonthTarget)}`} icon={ReceiptText} />
        <MetricCard label="Growth vs LY" value={sameDateGrowth.growthVsLy === null ? "-" : `${sameDateGrowth.growthVsLy.toFixed(2)}x`} detail="Current Year / Last Year" icon={Users} />
        <MetricCard label="Growth vs L2Y" value={sameDateGrowth.growthVsL2y === null ? "-" : `${sameDateGrowth.growthVsL2y.toFixed(2)}x`} detail="Current Year / Last 2 Years" icon={Users} />
      </section>
      {showDataActions ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <RevenueSourceChart data={revenueSourceData} />
          <RankingBarChart
            title="Product Mix"
            description="Revenue composition by product (retail)."
            data={data.productRevenueRetail}
            totalRevenue={data.kpis.nonBulkRevenue}
            orientation="vertical"
          />
        </section>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <RevenueSourceChart
              data={revenueSourceData}
              title="Territory Revenue Source"
              description="Retail vs Bulk Buying ratio"
            />
            <RegionalRevenueSourceChart data={data.regionalRevenueSource} />
          </section>
          <BranchRevenuePerformanceChart
            data={branchPerformance}
            academicYear={data.monthlyRevenueComparison.currentAcademicYear}
          />
        </>
      )}
      <MonthlyRevenueTable rows={data.monthlyRevenueComparison.rows} currentAcademicYear={data.monthlyRevenueComparison.currentAcademicYear} previousAcademicYear={data.monthlyRevenueComparison.previousAcademicYear} targetAnnualRevenue={kpis.targetAnnualRevenue} />
    </div>
  );
}

export default function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RevenuePageContent searchParams={searchParams} />;
}
