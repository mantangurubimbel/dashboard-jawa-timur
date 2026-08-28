import { ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import { RevenueCell } from "@/components/analytics-table";
import { ProductFilters } from "@/components/product-filters";
import { ProductRevenueChart } from "@/components/revenue-charts";
import { getProductAnalytics, getProductRevenueComparisons } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";
import { supabaseRestFetch } from "@/lib/supabase-server";
import { getDashboardBranchScope } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
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
  const branchParams = new URLSearchParams({
    select: "branch_id,branch_name",
    region_id: "not.is.null",
    order: "branch_name",
    limit: "1000",
  });
  if (branchScope !== null) {
    branchParams.set("branch_id", branchScope.length ? `in.(${branchScope.join(",")})` : "in.(-1)");
  }
  const [academicYears, branchesResponse] = await Promise.all([
    getRevenueAcademicYearOptions(),
    supabaseRestFetch(`t_branch?${branchParams.toString()}`),
  ]);
  const branches = branchesResponse.ok
    ? ((await branchesResponse.json()) as { branch_id: number; branch_name: string }[])
        .map((row) => ({ id: String(row.branch_id), label: row.branch_name }))
    : [];
  const academicYear = academicYears.some((year) => year.id === value("academicYear"))
    ? value("academicYear")
    : academicYears[0]?.id ?? "";
  const productFilters = {
    academicYear,
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
    fromDate: value("fromDate") || undefined,
    toDate: value("toDate") || undefined,
  };
  const [rows, productComparisons] = await Promise.all([
    getProductAnalytics(productFilters, branchScope),
    getProductRevenueComparisons(productFilters, branchScope),
  ]);
  const nonBulkRows = rows.filter((row) => !row.bulkBuying);
  const bulkRows = rows.filter((row) => row.bulkBuying);
  const nonBulkTotalRevenue = nonBulkRows.reduce((sum, row) => sum + row.revenue, 0);
  const nonBulkChartData = nonBulkRows.map((row, index) => ({
    rank: index + 1,
    product: row.product,
    revenue: row.revenue,
    share: nonBulkTotalRevenue ? row.revenue / nonBulkTotalRevenue : null,
    lyRevenue: productComparisons.ly.get(row.product.trim().toLowerCase()),
    l2yRevenue: productComparisons.l2y.get(row.product.trim().toLowerCase()),
  }));

  const renderGrowthRatio = (currentRevenue: number, previousRevenue: number | undefined) => {
    if (!previousRevenue || previousRevenue <= 0) {
      return <span className="text-slate-400">-</span>;
    }

    const ratio = currentRevenue / previousRevenue;
    if (ratio > 1) {
      return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-emerald-700">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          {ratio.toFixed(2)}x
        </span>
      );
    }
    if (ratio < 1) {
      return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-rose-700">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          {ratio.toFixed(2)}x
        </span>
      );
    }
    return <span className="whitespace-nowrap font-semibold text-slate-500">{ratio.toFixed(2)}x</span>;
  };

  const renderProductCard = (
    title: string,
    cardRows: typeof rows,
    showComparison = false,
  ) => {
    const total = cardRows.reduce((sum, row) => sum + row.revenue, 0);

    return (
      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        </div>
        <table className={`w-full border-collapse text-left text-sm ${showComparison ? "min-w-[700px]" : "min-w-[560px]"}`}>
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              {["Rank", "Product", "Revenue", "Share", ...(showComparison ? ["vs LY & L2Y"] : [])].map((label, index) => (
                <th
                  key={label}
                  className={`px-3 py-2 font-semibold ${index >= 2 ? "text-right" : ""}`}
                >
                  {label === "vs LY & L2Y" ? (
                    <span className="whitespace-nowrap">
                      <span className="block">{label}</span>
                    </span>
                  ) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cardRows.map((row, index) => (
              <tr key={row.product} className="transition-colors hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.product}</td>
                <td className="px-3 py-2 text-right">
                  <RevenueCell value={row.revenue} />
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {total ? `${((row.revenue / total) * 100).toFixed(1)}%` : "-"}
                </td>
                {showComparison ? (
                  <td className="px-3 py-2 text-right text-xs">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {renderGrowthRatio(row.revenue, productComparisons.ly.get(row.product.trim().toLowerCase()))}
                      <span className="text-slate-400">/</span>
                      {renderGrowthRatio(row.revenue, productComparisons.l2y.get(row.product.trim().toLowerCase()))}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!cardRows.length ? (
              <tr>
                <td colSpan={showComparison ? 5 : 4} className="px-3 py-10 text-center text-slate-500">
                  No product data available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          {formatNumber(cardRows.length)} products displayed
        </div>
      </section>
    );
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Product Performance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Product Performance</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Revenue, transaction, and invoice contribution by product.</p>
      </header>
      <ProductFilters
        academicYears={academicYears.map((year) => year.id)}
        branches={branches}
        values={{
          academicYear,
          branchId: value("branchId"),
          fromDate: value("fromDate"),
          toDate: value("toDate"),
        }}
      />
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {renderProductCard("Non Bulk Buying", nonBulkRows, true)}
        {renderProductCard("Bulk Buying", bulkRows)}
      </section>
      <ProductRevenueChart
        title="Non Bulk Buying Revenue by Product"
        description="Revenue chart from the Non Bulk Buying table based on the active filters."
        data={nonBulkChartData}
      />
      <p className="text-xs text-slate-500">Total {formatNumber(rows.length)} active product rows.</p>
    </div>
  );
}
