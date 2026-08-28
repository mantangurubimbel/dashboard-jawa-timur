import { formatNumber } from "@/lib/format";

type SchoolSmaSummaryRow = {
  npsn: string;
  school: string;
  years: {
    academicYear: string;
    grade10: number;
    grade11: number;
    grade12: number;
    total: number;
  }[];
};

export function StudentSchoolSmaTable({ rows }: { rows: SchoolSmaSummaryRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Student Count by Source School (SMA)</h2>
        <p className="mt-1 text-sm text-slate-500">Year-over-year comparison with LY and L2Y for SMA</p>
      </div>
      <div className="max-h-[760px] overflow-auto">
        <table className="min-w-[980px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-72" />
            {rows[0]?.years.flatMap((year) =>
              ["10 SMA", "11 SMA", "12 SMA", "Total"].map((label) => (
                <col key={`${year.academicYear}-${label}`} className="min-w-24" />
              )),
            )}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-100 text-xs uppercase text-slate-700">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 min-w-72 border border-slate-100 bg-slate-100 px-3 py-2 font-semibold">
                School
              </th>
              {rows[0]?.years.map((year) => (
                <th
                  key={year.academicYear}
                  colSpan={4}
                  className="border border-slate-100 px-3 py-2 text-center text-sm font-bold"
                >
                  {year.academicYear}
                </th>
              ))}
            </tr>
            <tr>
              {rows[0]?.years.flatMap((year) => ["10 SMA", "11 SMA", "12 SMA", "Total"].map((label) => (
                <th
                  key={`${year.academicYear}-${label}`}
                  className="min-w-24 border border-slate-100 px-3 py-2 text-center font-semibold"
                >
                  {label}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.npsn} className="student-school-row group">
                <td
                  className="student-school-cell sticky left-0 z-10 min-w-72 border border-slate-100 bg-white px-3 py-2 font-medium text-slate-800 transition-colors"
                >
                  <span className="block truncate whitespace-nowrap" title={row.school}>
                    {row.school}
                  </span>
                </td>
                {row.years.flatMap((year) => [year.grade10, year.grade11, year.grade12, year.total].map((value, index) => (
                  <td
                    key={`${row.school}-${year.academicYear}-${index}`}
                    className={`border border-slate-100 bg-white px-3 py-2 text-center transition-colors ${index === 3 ? "font-semibold text-teal-700" : "text-slate-600"}`}
                  >
                    {formatNumber(value)}
                  </td>
                )))}
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-500">No SMA school data available.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {formatNumber(rows.length)} schools displayed. Gap Year is included in Grade 12 calculations.
      </div>
    </section>
  );
}
