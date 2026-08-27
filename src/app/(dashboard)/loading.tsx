import { LoaderCircle } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 text-slate-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" aria-hidden />
        <span className="text-sm font-medium">Memuat data...</span>
      </div>
    </div>
  );
}
