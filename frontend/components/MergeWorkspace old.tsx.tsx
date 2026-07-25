"use client";

import { useMemo } from "react";

export interface PDFFile {
  id: string;
  filename: string;
  extension: string;
  size: number;
  pages: number;
  encrypted: boolean;
  corrupted: boolean;
  status: string;
  message?: string;
  password?: string;
  showPassword?: boolean;
  skipped?: boolean;
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
}

export default function MergeWorkspace({
  files,
  onPasswordChange,
  onTogglePassword,
  onSkipFile,
}: Props) {
  const summary = useMemo(() => {
    let ready = 0;
    let protectedFiles = 0;
    let corrupted = 0;

    files.forEach((file) => {
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
      corrupted,
    };
  }, [files]);

  return (
    <div className="mt-10 w-full max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-lg">

      {/* Header */}

      <div className="border-b px-8 py-6">
        <h2 className="text-3xl font-bold text-gray-900">
          Merge Workspace
        </h2>

        <p className="mt-2 text-gray-500">
          Review uploaded PDF files before merging.
        </p>
      </div>

      {/* Files */}

      <div className="divide-y">

        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between px-8 py-5"
          >
            <div>
              <div className="font-semibold text-lg">
                {file.filename}
              </div>

              <div className="text-sm text-gray-500">
                {file.pages} Pages • {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>

            <div>
			{file.skipped && (
           <span className="rounded-full bg-gray-200 px-4 py-2 font-semibold text-gray-700">
            ⏭ Skipped
          </span>
           )}
			
			
              {!file.skipped && file.status === "ready" && (
                <span className="rounded-full bg-green-100 px-4 py-2 font-semibold text-green-700">
                  ✅ Ready
                </span>
              )}

              {file.status === "password_required" && (
  <div className="flex flex-col items-end gap-3">

    <span className="rounded-full bg-yellow-100 px-4 py-2 font-semibold text-yellow-700">
      🔒 Password Required
    </span>

   
  <input
  type={file.showPassword ? "text" : "password"}
  placeholder="Enter PDF Password"
  value={file.password || ""}
  onChange={(e) => {
    onPasswordChange(file.id, e.target.value);
  }}
  className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
/>

<button
  type="button"
  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
  onClick={() => {
  onTogglePassword(file.id);
}}
>
  👁 {file.showPassword ? "Hide Password" : "Show Password"}
</button>
<button
  type="button"
  className={`mt-2 text-sm font-medium ${
    file.skipped
      ? "text-green-600 hover:text-green-800"
      : "text-red-600 hover:text-red-800"
  }`}
  onClick={() => {
    onSkipFile(file.id);
  }}
>
  {file.skipped ? "↩ Restore File" : "⏭ Skip File"}
</button>

  </div>
)}

              {!file.skipped && file.status === "corrupted" && (
                <span className="rounded-full bg-red-100 px-4 py-2 font-semibold text-red-700">
                  ❌ Corrupted
                </span>
              )}
            </div>
          </div>
        ))}

      </div>

      {/* Summary */}

      <div className="border-t bg-gray-50 px-8 py-6">

        <div className="grid grid-cols-4 gap-6 text-center">

          <div>
            <div className="text-3xl font-bold">
              {summary.total}
            </div>

            <div className="text-gray-500">
              Total
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-green-600">
              {summary.ready}
            </div>

            <div className="text-gray-500">
              Ready
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-yellow-600">
              {summary.protectedFiles}
            </div>

            <div className="text-gray-500">
              Protected
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-red-600">
              {summary.corrupted}
            </div>

            <div className="text-gray-500">
              Corrupted
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}