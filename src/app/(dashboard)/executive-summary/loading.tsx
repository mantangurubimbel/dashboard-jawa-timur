export default function ExecutiveSummaryLoading() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8" aria-label="Loading executive summary">
      <header className="border-b border-slate-200 pb-5">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>

      <div className="h-80 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="h-96 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />
        <div className="h-96 animate-pulse rounded-md border border-slate-200 bg-white shadow-sm" />
      </section>
    </div>
  );
}
