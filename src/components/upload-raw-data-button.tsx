"use client";

import { CloudUpload, LoaderCircle, X } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UploadResult = {
  message?: string;
  error?: string;
  preview?: boolean;
  existingRows?: number;
  deleted?: number;
  replacedDates?: number;
  replacementDates?: string[];
  inserted?: number;
  report?: {
    inputRows: number;
    filteredRows: number;
    outputRows: number;
    oecDiscountOverrideRows: number;
  };
};

export function UploadRawDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setConfirmed(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !startDate) return;

    setBusy(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate);
    formData.append("mode", confirmed ? "commit" : "preview");

    try {
      const response = await fetch("/api/revenue-upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResult;
      setResult(payload);
      if (response.ok && payload.inserted !== undefined && !payload.preview) {
        router.refresh();
      }
    } catch {
      setResult({ error: "Unable to connect to the upload server." });
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
    setResult(null);
    setConfirmed(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
      >
        <CloudUpload className="h-4 w-4" aria-hidden />
        Upload Raw Data
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-raw-data-title"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="upload-raw-data-title" className="text-lg font-semibold text-slate-950">
                  Upload Raw Data
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The CSV will be cleaned, mapped to master data, and saved to Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">CSV file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFileChange}
                  className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                  required
                />
                {file ? <span className="mt-1 block text-xs text-slate-500">{file.name}</span> : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setResult(null);
                    setConfirmed(false);
                  }}
                  className="mt-2 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  required
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Only rows with a payment_date on or after this date will be processed.
                </span>
              </label>

              {result?.error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {result.error}
                </div>
              ) : null}

              {result?.message ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">{result.message}</p>
                  {result.report ? (
                    <p className="mt-1 leading-5">
                      {result.report.filteredRows.toLocaleString("id-ID")} rows passed the filter.
                      {result.preview
                        ? ` ${result.existingRows?.toLocaleString("id-ID") ?? 0} existing rows across ${result.replacementDates?.length ?? 0} dates will be replaced.`
                        : ` ${result.deleted?.toLocaleString("id-ID") ?? 0} existing rows were replaced with ${result.inserted?.toLocaleString("id-ID") ?? 0} new rows across ${result.replacedDates?.toLocaleString("id-ID") ?? 0} dates.`}
                      {result.report.oecDiscountOverrideRows
                        ? ` ${result.report.oecDiscountOverrideRows.toLocaleString("id-ID")} rows use the OEC/Others agent.`
                        : ""}
                    </p>
                  ) : null}
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
                    I understand that existing data for dates included in the file will be deleted and
                    replaced with the new data.
                  </span>
                </label>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !file || !startDate || (result?.preview === true && !confirmed)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {busy ? "Processing..." : result?.preview ? "Replace & Upload" : "Preview Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
