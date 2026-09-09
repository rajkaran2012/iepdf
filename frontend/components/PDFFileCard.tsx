"use client";

import {
  FileText,
  Lock,
  AlertTriangle,
  SkipForward,
} from "lucide-react";

import type { PDFFile } from "./MergeWorkspace";

interface Props {
  file: PDFFile;

  onPasswordChange: (
    id: string,
    password: string
  ) => void;

  onSkip: (id: string) => void;
}

export default function PDFFileCard({
  file,
  onPasswordChange,
  onSkip,
}: Props) {
  return (
    <div className="p-6">

      <div className="flex items-start justify-between gap-6">

        {/* Left */}

        <div className="flex gap-4">

          <div className="rounded-xl bg-red-100 p-3">

            {file.encrypted ? (

              <Lock
                size={28}
                className="text-red-600"
              />

            ) : (

              <FileText
                size={28}
                className="text-red-600"
              />

            )}

          </div>

          <div>

            <h3 className="text-lg font-semibold text-gray-900">

              {file.filename}

            </h3>

            <p className="mt-1 text-sm text-gray-500">

              {file.pages} Pages •{" "}
              {(file.size / (1024 * 1024)).toFixed(2)} MB

            </p>

          </div>

        </div>

        {/* Right */}

        <div>

          {file.status === "ready" && (

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">

              ✓ Ready

            </span>

          )}

          {file.status === "corrupted" && (

            <span className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">

              <AlertTriangle size={16} />

              Corrupted

            </span>

          )}

        </div>

      </div>

      {/* Password Section */}

      {file.status === "password_required" && (

        <div className="mt-6 rounded-2xl bg-red-50 p-5 border border-red-200">

          <label className="block text-sm font-semibold text-gray-700">

            PDF Password

          </label>

          <input
            type="password"
            placeholder="Enter PDF password"
            value={file.password || ""}
            onChange={(e) =>
              onPasswordChange(
                file.id,
                e.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
          />

          <div className="mt-4 flex gap-3">

            <button
              onClick={() => onSkip(file.id)}
              className="flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-medium hover:bg-gray-200"
            >
              <SkipForward size={18} />

              Skip File
            </button>

          </div>

        </div>

      )}

      {/* Skipped */}

      {file.status === "skipped" && (

        <div className="mt-5 rounded-xl bg-gray-100 p-4 text-gray-600">

          ⏭ This file will be skipped during merge.

        </div>

      )}

    </div>
  );
}