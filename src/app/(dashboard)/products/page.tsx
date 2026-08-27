import { BarChart3 } from "lucide-react";
import { RevenueCell } from "@/components/analytics-table";
import { ProductFilters } from "@/components/product-filters";
import { getProductAnalytics } from "@/lib/analytics-data";
import { formatNumber } from "@/lib/format";
import { getRevenueAcademicYearOptions } from "@/lib/revenue-filters";
import { supabaseRestFetch } from "@/lib/supabase-server";

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
  const [academicYears, branchesResponse] = await Promise.all([
    getRevenueAcademicYearOptions(),
    supabaseRestFetch("t_branch?select=branch_id,branch_name&region_id=not.is.null&order=branch_name&limit=1000"),
  ]);
  const branches = branchesResponse.ok
    ? ((await branchesResponse.json()) as { branch_id: number; branch_name: string }[])
        .map((row) => ({ id: String(row.branch_id), label: row.branch_name }))
    : [];
  const academicYear = academicYears.some((year) => year.id === value("academicYear"))
    ? value("academicYear")
    : academicYears[0]?.id ?? "";
  const rows = await getProductAnalytics({
    academicYear,
    branchId: value("branchId") ? Number(value("branchId")) : undefined,
    fromDate: value("fromDate") || undefined,
    toDate: value("toDate") || undefined,
  });
  const nonBulkRows = rows.filter((row) => !row.bulkBuying);
  const bulkRows = rows.filter((row) => row.bulkBuying);

  const renderProductCard = (
    title: string,
    cardRows: typeof rows,
  ) => {
    const total = cardRows.reduce((sum, row) => sum + row.revenue, 0);

    return (
      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        </div>
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              {["Rank", "Product", "Revenue", "Share"].map((label, index) => (
                <th
                  key={label}
                  className={`px-3 py-2 font-semibold ${index >= 2 ? "text-right" : ""}`}
                >
                  {label}
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
              </tr>
            ))}
            {!cardRows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                  Belum ada data product.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          {formatNumber(cardRows.length)} product ditampilkan
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
        <p className="mt-2 text-sm text-slate-600">Kontribusi revenue, transaksi, dan invoice per product.</p>
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
      <section className="grid gap-6 lg:grid-cols-2">
        {renderProductCard("Non Bulk Buying", nonBulkRows)}
        {renderProductCard("Bulk Buying", bulkRows)}
      </section>
      <p className="text-xs text-slate-500">Total {formatNumber(rows.length)} baris product aktif.</p>
    </div>
  );
}
