"use client";

import { useMemo } from "react";

export interface PDFFile {
  id: string;
  filename: string;
  extension: string;
  size: number;
  pages: number;

  status: string;

  encrypted: boolean;
  corrupted: boolean;

  password?: string;
  showPassword?: boolean;
  skipped?: boolean;

  message?: string;
}

interface Props {
  files: PDFFile[];

  onPasswordChange: (
    id: string,
    password: string
  ) => void;

  onTogglePassword: (
    id: string
  ) => void;

  onSkipFile: (
    id: string
  ) => void;

  onUnlockMerge: () => void;
}

export default function MergeWorkspace({
  files,
  onPasswordChange,
  onTogglePassword,
  onSkipFile,
  onUnlockMerge,
}: Props) {

  const summary = useMemo(() => {

    let ready = 0;
    let protectedFiles = 0;
    let skipped = 0;
    let corrupted = 0;

    files.forEach((file) => {

      if (file.skipped) {
        skipped++;
        return;
      }

      if (file.status === "ready") {
        ready++;
      }

      if (file.status === "password_required") {
        protectedFiles++;
      }

      if (file.status === "corrupted") {
        corrupted++;
      }

    });

    return {
      total: files.length,
      ready,
      protectedFiles,
      skipped,
      corrupted,
    };

  }, [files]);

  return (

    <div className="mt-10 w-full max-w-6xl rounded-3xl border border-gray-200 bg-white shadow-xl">

      {/* =========================
          HEADER
      ========================== */}

      <div className="border-b px-8 py-6">

        <h2 className="text-3xl font-bold">
          Merge Workspace
        </h2>

        <p className="mt-2 text-gray-500">
          Review every PDF before merging.
        </p>

      </div>

      {/* =========================
            FILE LIST
      ========================== */}

      <div className="divide-y">
{files.map((file) => (

  <div
    key={file.id}
    className="flex items-start justify-between px-8 py-6"
  >

    {/* Left Side */}

    <div className="flex-1">

      <h3 className="text-lg font-semibold">
        {file.filename}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        {file.pages} Pages • {(file.size / 1024 / 1024).toFixed(2)} MB
      </p>

    </div>

    {/* Right Side */}

    <div className="flex w-80 flex-col items-end gap-3">

      {/* Skipped */}

      {file.skipped && (

        <span className="rounded-full bg-gray-200 px-4 py-2 font-semibold text-gray-700">

          ⏭ Skipped

        </span>

      )}

      {/* Ready */}

      {!file.skipped &&
        file.status === "ready" && (

        <span className="rounded-full bg-green-100 px-4 py-2 font-semibold text-green-700">

          ✅ Ready

        </span>

      )}

      {/* Corrupted */}

      {!file.skipped &&
        file.status === "corrupted" && (

        <span className="rounded-full bg-red-100 px-4 py-2 font-semibold text-red-700">

          ❌ Corrupted

        </span>

      )}

      {/* Password Required */}

      {file.status === "password_required" && (

        <div className="flex w-full flex-col items-end gap-3">

          {!file.skipped && (

            <>

              <span className="rounded-full bg-yellow-100 px-4 py-2 font-semibold text-yellow-700">

                🔒 Password Required

              </span>

              <input
                type={file.showPassword ? "text" : "password"}
                value={file.password || ""}
                placeholder="Enter PDF Password"
                onChange={(e) =>
                  onPasswordChange(
                    file.filename,
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <button
                type="button"
                onClick={() =>
                  onTogglePassword(file.id)
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                👁{" "}
                {file.showPassword
                  ? "Hide Password"
                  : "Show Password"}
              </button>

            </>

          )}

          <button
            type="button"
            onClick={() =>
              onSkipFile(file.id)
            }
            className={`text-sm font-semibold ${
              file.skipped
                ? "text-green-600 hover:text-green-800"
                : "text-red-600 hover:text-red-800"
            }`}
          >
            {file.skipped
              ? "↩ Restore File"
              : "⏭ Skip File"}
          </button>

        </div>

      )}

    </div>

  </div>

))}

      </div>

      {/* =========================
            SUMMARY
      ========================== */}

      <div className="border-t bg-gray-50 px-8 py-8">

        <div className="grid grid-cols-5 gap-6">

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-3xl font-bold">
              {summary.total}
            </div>

            <div className="mt-2 text-gray-500">
              Total
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-green-600">
              {summary.ready}
            </div>

            <div className="mt-2 text-gray-500">
              Ready
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-yellow-600">
              {summary.protectedFiles}
            </div>

            <div className="mt-2 text-gray-500">
              Protected
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-blue-600">
              {summary.skipped}
            </div>

            <div className="mt-2 text-gray-500">
              Skipped
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-3xl font-bold text-red-600">
              {summary.corrupted}
            </div>

            <div className="mt-2 text-gray-500">
              Corrupted
            </div>
          </div>

        </div>

        <div className="mt-8 flex justify-center">

          <button
          type="button"
          disabled={summary.ready === 0}
          onClick={onUnlockMerge}
          className={`rounded-2xl px-10 py-4 text-lg font-semibold text-white transition ${
          summary.ready === 0
          ? "cursor-not-allowed bg-gray-400"
          : "bg-blue-600 hover:bg-blue-700"
  }`}
>
  🔓 Unlock & Merge
</button>

        </div>

      </div>

    </div>

  );

}