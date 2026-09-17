import { CalendarDays } from "lucide-react";

function formatTransactionDate(value: string | null) {
  if (!value) return "No transaction data";
  const datePart = value.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
}

export function LatestTransactionDate({
  date,
  label = "Data through",
}: {
  date: string | null;
  label?: string;
}) {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
      <CalendarDays className="h-3.5 w-3.5 text-teal-700" aria-hidden />
      <span>{label}: <span className="font-semibold text-slate-700">{formatTransactionDate(date)}</span></span>
    </p>
  );
}
