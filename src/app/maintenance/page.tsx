import Link from "next/link";
import { Wrench } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getMaintenanceMessage() {
  try {
    const response = await supabaseRestFetch(
      "t_dashboard_maintenance?select=is_active,message&id=eq.1&limit=1",
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as {
      is_active?: boolean;
      message?: string;
    }[];
    const row = rows[0];
    return row?.is_active ? row.message : null;
  } catch {
    return null;
  }
}

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-900/60 text-teal-300">
          <Wrench className="h-7 w-7" aria-hidden />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-teal-300">
          Website Under Maintenance
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">We&apos;ll be back soon</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {message || "This website is currently under maintenance. Please check back later."}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-teal-500 hover:text-white"
        >
          Admin sign in
        </Link>
      </section>
    </main>
  );
}
