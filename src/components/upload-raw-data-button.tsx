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
    invalidRows: number;
    oecDiscountOverrideRows: number;
  };
  failedRows?: FailedRow[];
};

type FailedRow = {
  id?: number;
  batchId?: string;
  rowNumber: number;
  raw: Record<string, string>;
  missingFields: string[];
  error?: string | null;
};

function isBlank(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text.toLowerCase() === "null";
}

export function UploadRawDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  async function loadPendingRows() {
    setPendingLoading(true);
    try {
      const response = await fetch("/api/revenue-upload-issues", { cache: "no-store" });
      const payload = (await response.json()) as { issues?: FailedRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load incomplete rows.");
      setFailedRows(payload.issues ?? []);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unable to load incomplete rows." });
    } finally {
      setPendingLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    setResult(null);
    setConfirmed(false);
    void loadPendingRows();
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setConfirmed(false);
    setFailedRows([]);
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
      setFailedRows(payload.failedRows ?? []);
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
    if (busy || resolvingId !== null) return;
    setOpen(false);
    setResult(null);
    setConfirmed(false);
  }

  function updateFailedRow(id: number, field: string, value: string) {
    setFailedRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const raw = { ...row.raw, [field]: value };
      return {
        ...row,
        raw,
        missingFields: ["Agent Name", "Agent Email", "Cluster"].filter(
          (requiredField) => isBlank(raw[requiredField]),
        ),
        error: null,
      };
    }));
  }

  async function uploadCompletedRow(row: FailedRow) {
    if (!row.id) return;
    setResolvingId(row.id);
    try {
      const response = await fetch("/api/revenue-upload-issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          agentName: row.raw["Agent Name"] ?? "",
          agentEmail: row.raw["Agent Email"] ?? "",
          cluster: row.raw.Cluster ?? "",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to upload completed row.");
      setFailedRows((rows) => rows.filter((item) => item.id !== row.id));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload completed row.";
      setFailedRows((rows) => rows.map((item) => item.id === row.id ? { ...item, error: message } : item));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
            className="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl"
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
                      {result.report.invalidRows
                        ? ` ${result.report.invalidRows.toLocaleString("id-ID")} rows need Agent Name, Agent Email, and Cluster completed.`
                        : ""}
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

              {pendingLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Loading incomplete rows...
                </div>
              ) : null}

              {failedRows.length ? (
                <section className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-amber-950">
                        Incomplete rows ({failedRows.length.toLocaleString("id-ID")})
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        Complete the required fields, then upload each row individually.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded border border-amber-200 bg-white">
                    <table className="min-w-[980px] w-full text-left text-xs text-slate-700">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">CSV row</th>
                          <th className="px-3 py-2">Payment date</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Agent Name *</th>
                          <th className="px-3 py-2">Agent Email *</th>
                          <th className="px-3 py-2">Cluster *</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {failedRows.map((row) => {
                          const raw = row.raw ?? {};
                          const isResolving = resolvingId === row.id;
                          return (
                            <tr key={row.id ?? row.rowNumber} className="align-top">
                              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.rowNumber}</td>
                              <td className="whitespace-nowrap px-3 py-2">{raw["Payment Date"] || "—"}</td>
                              <td className="max-w-40 truncate px-3 py-2" title={raw.Invoice || undefined}>{raw.Invoice || "—"}</td>
                              {["Agent Name", "Agent Email", "Cluster"].map((field) => {
                                const missing = row.missingFields.includes(field);
                                return (
                                  <td key={field} className="px-3 py-2">
                                    <input
                                      value={raw[field] ?? ""}
                                      onChange={(event) => row.id && updateFailedRow(row.id, field, event.target.value)}
                                      placeholder={missing ? `Enter ${field}` : undefined}
                                      className={`h-8 w-44 rounded border px-2 text-xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-100 ${missing ? "border-rose-300 bg-rose-50" : "border-slate-300 bg-white"}`}
                                    />
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2">
                                {row.id ? (
                                  <button
                                    type="button"
                                    onClick={() => uploadCompletedRow(row)}
                                    disabled={isResolving || row.missingFields.length > 0}
                                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded bg-teal-700 px-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isResolving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                                    {isResolving ? "Uploading..." : "Upload row"}
                                  </button>
                                ) : (
                                  <span className="text-slate-500">Available after commit</span>
                                )}
                                {row.error ? <p className="mt-1 max-w-48 text-[11px] leading-4 text-rose-700">{row.error}</p> : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
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
