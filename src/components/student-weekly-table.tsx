import { formatNumber } from "@/lib/format";

type WeeklyStudentTableProps = {
  weeks: { label: string; fromDate: string; toDate: string }[];
  rows: { branch: string; values: number[] }[];
};

export function StudentWeeklyTable({ weeks, rows }: WeeklyStudentTableProps) {
  const visibility = (index: number) => {
    const fromEnd = weeks.length - index;
    if (fromEnd <= 2) return { cell: "table-cell", column: "" };
    if (fromEnd <= 4) return { cell: "hidden md:table-cell", column: "hidden md:table-column" };
    if (fromEnd <= 6) return { cell: "hidden xl:table-cell", column: "hidden xl:table-column" };
    if (fromEnd <= 8) return { cell: "hidden 2xl:table-cell", column: "hidden 2xl:table-column" };
    return { cell: "hidden", column: "hidden" };
  };
  const weekWidthClass =
    "w-[calc((100%_-_18rem)/2)] 2xl:w-[calc((100%_-_20rem)/8)] md:w-[calc((100%_-_18rem)/4)] xl:w-[calc((100%_-_18rem)/6)]";

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Weekly Student Additions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Additions based on payment date, Monday through Sunday.
        </p>
      </div>
      <div className="max-h-[calc(100vh-18rem)] min-h-[360px] overflow-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-72 2xl:w-80" />
            {weeks.map((week, index) => (
              <col
                key={week.fromDate}
                className={`${visibility(index).column} ${weekWidthClass}`}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="sticky left-0 z-30 w-72 border-r border-slate-300 bg-slate-100 px-3 py-2 font-semibold whitespace-nowrap 2xl:w-80">
                Branch
              </th>
              {weeks.map((week) => (
                <th
                  key={week.fromDate}
                  className={`${visibility(weeks.indexOf(week)).cell} ${weekWidthClass} border-r border-slate-200 px-2 py-2 text-center font-semibold`}
                >
                  <span className="flex flex-col items-center text-[11px] leading-tight">
                    <span>{week.label.split(" - ")[0]}</span>
                    <span>-</span>
                    <span>{week.label.split(" - ")[1]}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.branch} className="group transition-colors hover:bg-slate-50">
                <td className="sticky left-0 z-10 w-72 border-r border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 whitespace-nowrap group-hover:bg-slate-50 2xl:w-80">
                  {row.branch}
                </td>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.branch}-${index}`}
                    className={`${visibility(index).cell} ${weekWidthClass} border-r border-slate-100 px-2 py-2 text-center text-slate-600`}
                  >
                    <span className={value === 0 ? "text-rose-700" : "text-slate-600"}>
                      {formatNumber(value)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={weeks.length + 1} className="px-3 py-8 text-center text-slate-500">
                  No student additions available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {formatNumber(rows.length)} branches · {formatNumber(weeks.length)} weeks
      </div>
    </section>
  );
}
