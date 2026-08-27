"use client";

import { FileUp, LoaderCircle, X } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type TargetKind = "annual" | "monthly";

type ImportResult = {
  message?: string;
  error?: string;
  preview?: boolean;
  imported?: number;
  report?: {
    inputRows: number;
    outputRows: number;
    invalidRows: number;
    duplicateRows: number;
    errors: { row: number; message: string }[];
  };
};

export function ImportRevenueTargetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TargetKind>("monthly");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function chooseKind(nextKind: TargetKind) {
    setKind(nextKind);
    setFile(null);
    setResult(null);
    setConfirmed(false);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setConfirmed(false);
  }

  async function submit(mode: "preview" | "commit") {
    if (!file) return;

    setBusy(true);
    setResult(null);
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("mode", mode);
    formData.append("file", file);

    try {
      const response = await fetch("/api/revenue-target-upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ImportResult;
      setResult(payload);
      if (response.ok && mode === "commit") {
        router.refresh();
      }
    } catch {
      setResult({ error: "Tidak dapat terhubung ke server import target." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50"
      >
        <FileUp className="h-4 w-4" aria-hidden />
        Import Target
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-target-title"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="import-target-title" className="text-lg font-semibold text-slate-950">
                  Import Target Revenue
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Target di-upsert berdasarkan academic year dan branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Tutup modal"
                title="Tutup modal"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
                {(["monthly", "annual"] as TargetKind[]).map((targetKind) => (
                  <button
                    type="button"
                    key={targetKind}
                    onClick={() => chooseKind(targetKind)}
                    className={`h-9 rounded text-sm font-semibold ${
                      kind === targetKind
                        ? "bg-white text-teal-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {targetKind === "monthly" ? "Monthly Target" : "Annual Target"}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">File CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={chooseFile}
                  className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {kind === "monthly"
                    ? "Header: academic_year, branch_id atau branch_name, month, target_revenue"
                    : "Header: academic_year, branch_id atau branch_name, target_revenue"}
                </span>
              </label>

              {result?.error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  <p className="font-semibold">{result.error}</p>
                  {result.report?.errors.slice(0, 3).map((error) => (
                    <p key={`${error.row}-${error.message}`} className="mt-1">
                      Baris {error.row}: {error.message}
                    </p>
                  ))}
                </div>
              ) : null}

              {result?.message ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">{result.message}</p>
                  <p className="mt-1">
                    {result.report?.outputRows.toLocaleString("id-ID")} baris valid siap diproses.
                  </p>
                </div>
              ) : null}

              {result?.preview ? (
                <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-teal-700"
                  />
                  <span>
                    Saya memahami bahwa target yang sama akan di-update dengan nilai dari file ini.
                  </span>
                </label>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => submit(result?.preview && confirmed ? "commit" : "preview")}
                  disabled={busy || !file || (result?.preview === true && !confirmed)}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {busy ? "Memproses..." : result?.preview ? "Import Target" : "Preview"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
