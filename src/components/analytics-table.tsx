import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type Column<T> = {
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

export function AnalyticsTable<T extends { revenue: number }>({
  rows,
  columns,
  empty = "No data available.",
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={`px-3 py-2 font-semibold ${column.align === "right" ? "text-right" : ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row.revenue)}`} className="transition-colors hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.label} className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">{empty}</td></tr>
          ) : null}
        </tbody>
      </table>
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        {formatNumber(rows.length)} rows displayed
      </div>
    </div>
  );
}

export function RevenueCell({ value }: { value: number }) {
  return <span className="font-semibold text-teal-700">{formatCurrency(value)}</span>;
}

export function NumberCell({ value }: { value: number }) {
  return <span className="text-slate-600">{formatNumber(value)}</span>;
}

export function ShareCell({ value, total }: { value: number; total: number }) {
  return <span className="text-slate-500">{total ? formatPercent(value / total) : "-"}</span>;
}
