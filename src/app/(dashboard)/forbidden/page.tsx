import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-md border border-rose-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">You are not authorized to access this page</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The Settings page is only available to dashboard administrators.
        </p>
        <Link href="/executive-summary" className="mt-6 inline-flex rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
