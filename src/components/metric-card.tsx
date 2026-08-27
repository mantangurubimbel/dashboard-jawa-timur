import { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-teal-600" aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </section>
  );
}
