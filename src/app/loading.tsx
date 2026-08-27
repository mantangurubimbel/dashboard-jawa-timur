import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-50"
      aria-label="Memuat dashboard"
    >
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <LoaderCircle className="h-9 w-9 animate-spin text-teal-700" aria-hidden />
        <p className="text-sm font-medium">Memuat data revenue...</p>
      </div>
    </main>
  );
}
