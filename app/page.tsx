'use client';

import React, { useMemo, useState } from "react";

type CountResult = {
  total_files: number;
  total_lines: number;
  line_counts_by_ext: Record<string, number>;
  file_counts_by_ext: Record<string, number>;
  top_files: { path: string; lines: number }[];
};

const API_SCAN_URL = "/api/scan-extensions";
const API_COUNT_URL = "/api/count-lines";

const byteFormatter = new Intl.NumberFormat(undefined, {
  style: "unit",
  unit: "byte",
  unitDisplay: "short",
  notation: "compact",
});

export default function Home() {
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<CountResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "top_files">("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => Object.values(selectedExtensions).filter(Boolean).length,
    [selectedExtensions],
  );

  const handleFileSelect: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setArchiveFile(file);
    setExtensions([]);
    setSelectedExtensions({});
    setResult(null);
    setError(null);
  };

  const ensureFileSelected = (): boolean => {
    if (!archiveFile) {
      setError("Please select a zip archive of your project first.");
      return false;
    }
    return true;
  };

  const submitArchive = async (url: string, extraFields?: Record<string, string[]>) => {
    if (!ensureFileSelected() || !archiveFile) {
      return null;
    }

    const formData = new FormData();
    formData.append("archive", archiveFile, archiveFile.name);

    if (extraFields) {
      Object.entries(extraFields).forEach(([key, values]) => {
        values.forEach((value) => formData.append(key, value));
      });
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Request failed");
    }

    return response.json();
  };

  const handleScanExtensions = async () => {
    if (!ensureFileSelected()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtensions([]);
    setSelectedExtensions({});
    setResult(null);

    try {
      const data = (await submitArchive(API_SCAN_URL)) as { extensions: string[] } | null;
      if (!data) {
        return;
      }

      setExtensions(data.extensions);
      setSelectedExtensions(
        data.extensions.reduce<Record<string, boolean>>((acc, ext) => {
          acc[ext] = true;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountLines = async () => {
    if (!ensureFileSelected()) {
      return;
    }

    const extensionsToCount = Object.entries(selectedExtensions)
      .filter(([, isSelected]) => isSelected)
      .map(([ext]) => ext);

    if (extensionsToCount.length === 0) {
      setError("Select at least one extension to count.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = (await submitArchive(API_COUNT_URL, { extensions: extensionsToCount })) as
        | CountResult
        | null;
      if (!data) {
        return;
      }

      setResult(data);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExtension = (ext: string) => {
    setSelectedExtensions((prev) => ({
      ...prev,
      [ext]: !prev[ext],
    }));
  };

  const selectAll = () => {
    setSelectedExtensions(
      extensions.reduce<Record<string, boolean>>((acc, ext) => {
        acc[ext] = true;
        return acc;
      }, {}),
    );
  };

  const deselectAll = () => {
    setSelectedExtensions(
      extensions.reduce<Record<string, boolean>>((acc, ext) => {
        acc[ext] = false;
        return acc;
      }, {}),
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 pb-16 pt-12">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur transition-all">
          <header className="space-y-3 border-b border-white/10 pb-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Line of Code Insight</p>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Upload an archive to discover what’s inside your codebase
            </h1>
            <p className="text-sm text-slate-400">
              Compress your project as a zip file. We’ll analyze it securely inside a sandboxed environment and surface extension-level insights in seconds.
            </p>
          </header>

          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <label
                htmlFor="archive"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/30 p-8 text-center transition hover:border-teal-300/60 hover:bg-black/20"
              >
                <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-teal-200/80">
                  Drop a .zip file here
                </div>
                <p className="text-lg font-medium text-white">
                  {archiveFile ? archiveFile.name : "Choose an archive"}
                </p>
                <p className="text-xs text-slate-400">
                  {archiveFile
                    ? `${byteFormatter.format(archiveFile.size)} • click to replace`
                    : "Maximum 200 MB"}
                </p>
                <input
                  id="archive"
                  name="archive"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>

              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleScanExtensions}
                  disabled={!archiveFile || isLoading}
                  className="rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                >
                  {isLoading ? "Processing…" : "Scan extensions"}
                </button>
                <button
                  type="button"
                  onClick={handleCountLines}
                  disabled={!archiveFile || extensions.length === 0 || isLoading}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-teal-300 hover:text-teal-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                >
                  {isLoading ? "Counting…" : "Count lines"}
                </button>
                {extensions.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {selectedCount} of {extensions.length} extensions selected
                  </span>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {extensions.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Extensions discovered</h2>
                      <p className="text-xs text-slate-400 font-medium">Select files to include in the count.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-white/20"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-white/20"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 text-xs sm:grid-cols-3">
                    {extensions.map((ext) => (
                      <label
                        key={ext}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition cursor-pointer ${
                          selectedExtensions[ext]
                            ? "border-teal-400/50 bg-teal-400/5 text-teal-100"
                            : "border-white/5 bg-black/20 text-slate-400 hover:border-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-white/20 bg-black/60 text-teal-500 focus:ring-teal-500/30"
                          checked={Boolean(selectedExtensions[ext])}
                          onChange={() => toggleExtension(ext)}
                        />
                        <span className="truncate font-medium" title={ext}>{ext}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
              <h2 className="text-lg font-semibold text-white">Checklist</h2>
              <ol className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${archiveFile ? "bg-emerald-400" : "bg-white/30"}`} />
                  <span>
                    Upload a <strong>.zip</strong> archive of the project you’d like to analyze.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${extensions.length > 0 ? "bg-emerald-400" : "bg-white/30"}`} />
                  <span>
                    Scan extensions to preview the languages and formats you’ve included.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${result ? "bg-emerald-400" : "bg-white/30"}`} />
                  <span>
                    Count lines to surface LOC totals and your top files by size.
                  </span>
                </li>
              </ol>
              {archiveFile && (
                <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                  <p className="font-semibold text-white">Current upload</p>
                  <p className="truncate text-white/80">{archiveFile.name}</p>
                  <p className="text-slate-400">{byteFormatter.format(archiveFile.size)}</p>
                  <p className="mt-2 text-[0.7rem] text-slate-400">
                    We process archives ephemerally inside the request. Nothing is stored beyond your session.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>

        {result && (
          <section className="min-h-[28rem] w-full rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur transition-all">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-white">Analysis summary</h2>
                <p className="text-sm text-slate-400">
                  Your archive contains <span className="font-semibold text-slate-200">{result.total_files.toLocaleString()}</span> files and <span className="font-semibold text-slate-200">{result.total_lines.toLocaleString()}</span> total lines.
                </p>
              </div>
              <div className="flex overflow-hidden rounded-full border border-white/10 bg-black/20 p-1 text-sm text-white">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`rounded-full px-4 py-2 transition ${
                    activeTab === "overview"
                      ? "bg-teal-400 text-slate-950 font-bold"
                      : "bg-transparent text-white hover:bg-white/10"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("top_files")}
                  className={`rounded-full px-4 py-2 transition ${
                    activeTab === "top_files"
                      ? "bg-teal-400 text-slate-950 font-bold"
                      : "bg-transparent text-white hover:bg-white/10"
                  }`}
                >
                  Top files
                </button>
              </div>
            </div>

            {activeTab === "overview" && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Line counts by extension</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {Object.entries(result.line_counts_by_ext).map(([ext, count]) => (
                      <li key={ext} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                        <span className="font-medium text-white">{ext}</span>
                        <span>{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">File counts by extension</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {Object.entries(result.file_counts_by_ext).map(([ext, count]) => (
                      <li key={ext} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                        <span className="font-medium text-white">{ext}</span>
                        <span>{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "top_files" && (
              <div className="mt-6 space-y-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top {result.top_files.length} files by line count</p>
                <div className="max-h-[32rem] overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-black/20 scrollbar-thin scrollbar-thumb-white/10">
                  <ul className="divide-y divide-white/5">
                    {result.top_files.map((file, index) => (
                      <li key={`${file.path}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-200 text-sm" title={file.path}>{file.path}</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">Rank {index + 1}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 min-w-[100px]">
                          <span className="whitespace-nowrap text-sm font-bold text-teal-400">
                            {file.lines.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500">lines</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
