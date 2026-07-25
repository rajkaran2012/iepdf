"use client";

import { ShieldCheck, Lock, SkipForward, TriangleAlert } from "lucide-react";

interface Props {
  ready: number;
  protectedFiles: number;
  skipped: number;
  corrupted: number;

  mergeDisabled: boolean;

  onMerge: () => void;
}

export default function MergeSummary({
  ready,
  protectedFiles,
  skipped,
  corrupted,
  mergeDisabled,
  onMerge,
}: Props) {
  return (
    <div className="border-t bg-gray-50 p-8">

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

        {/* Ready */}

        <div className="rounded-2xl bg-green-100 p-5">

          <div className="flex items-center gap-2">

            <ShieldCheck
              size={22}
              className="text-green-600"
            />

            <span className="text-sm font-medium text-gray-600">
              Ready
            </span>

          </div>

          <h2 className="mt-3 text-3xl font-bold text-green-700">

            {ready}

          </h2>

        </div>

        {/* Protected */}

        <div className="rounded-2xl bg-red-100 p-5">

          <div className="flex items-center gap-2">

            <Lock
              size={22}
              className="text-red-600"
            />

            <span className="text-sm font-medium text-gray-600">

              Protected

            </span>

          </div>

          <h2 className="mt-3 text-3xl font-bold text-red-700">

            {protectedFiles}

          </h2>

        </div>

        {/* Skipped */}

        <div className="rounded-2xl bg-gray-200 p-5">

          <div className="flex items-center gap-2">

            <SkipForward
              size={22}
            />

            <span className="text-sm font-medium text-gray-600">

              Skipped

            </span>

          </div>

          <h2 className="mt-3 text-3xl font-bold">

            {skipped}

          </h2>

        </div>

        {/* Corrupted */}

        <div className="rounded-2xl bg-yellow-100 p-5">

          <div className="flex items-center gap-2">

            <TriangleAlert
              size={22}
              className="text-yellow-600"
            />

            <span className="text-sm font-medium text-gray-600">

              Corrupted

            </span>

          </div>

          <h2 className="mt-3 text-3xl font-bold text-yellow-700">

            {corrupted}

          </h2>

        </div>

      </div>

      {/* Merge Button */}

      <div className="mt-8 flex justify-end">

        <button
          disabled={mergeDisabled}
          onClick={onMerge}
          className={`rounded-2xl px-8 py-4 text-lg font-semibold text-white transition-all

          ${
            mergeDisabled
              ? "cursor-not-allowed bg-gray-400"
              : "bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl"
          }`}
        >

          Merge Files

        </button>

      </div>

      {mergeDisabled && (

        <p className="mt-4 text-right text-sm text-red-600">

          Unlock or skip all protected PDFs before merging.

        </p>

      )}

    </div>
  );
}