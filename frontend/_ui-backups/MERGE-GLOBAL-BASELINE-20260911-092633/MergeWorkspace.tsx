"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const PdfThumbnail = dynamic(
    () => import("@/components/pdf/PdfThumbnail"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-48 w-36 items-center justify-center rounded-xl border bg-gray-100 text-sm text-gray-500">
                Loading Preview...
            </div>
        ),
    }
);

export interface PDFFile {

    id: string;

    file: File;

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

    onPasswordBlur: (
        id: string
    ) => void;

    onTogglePassword: (
        id: string
    ) => void;

    onSkipFile: (
        id: string
    ) => void;

    onRemoveFile: (
        id: string
    ) => void;

    onUnlockMerge: () => void;

}

export default function MergeWorkspace({

    files,

    onPasswordChange,

    onPasswordBlur,

    onTogglePassword,

    onSkipFile,

    onRemoveFile,

    onUnlockMerge,

}: Props) {

    const summary = useMemo(() => {

        let ready = 0;

        let protectedFiles = 0;

        let skipped = 0;

        let corrupted = 0;

        let invalid = 0;

        files.forEach((file) => {

            if (file.skipped) {

                skipped++;

                return;

            }

            switch (file.status) {

                case "ready":

                    ready++;

                    break;

                case "password_required":

                    protectedFiles++;

                    break;

                case "corrupted":

                    corrupted++;

                    break;

                case "invalid":

                    invalid++;

                    break;

            }

        });

        return {

            total: files.length,

            ready,

            protectedFiles,

            skipped,

            corrupted,

            invalid,

        };

    }, [files]);

    const canMerge = useMemo(() => {

        const activeFiles = files.filter(file => !file.skipped);

        if (activeFiles.length < 2) {
            return false;
        }

        return activeFiles.every(
            file => file.status === "ready" || (
                file.status === "password_required" &&
                Boolean(file.password?.trim())
            )
        );

    }, [files]);

    return (

        <div className="relative mt-2 grid h-[calc(100vh-225px)] min-h-[430px] w-[90vw] max-w-[1400px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[minmax(0,1fr)_320px]">

            {/* =========================
                HEADER
            ========================== */}

            <div className="border-b px-8 py-4 lg:col-span-2 lg:row-start-1">

                <h2 className="text-2xl font-bold">
                    Merge Workspace
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Review every PDF before merging.
                </p>

            </div>

            {/* =========================
                FILE LIST
            ========================== */}

            <div className="min-h-0 overflow-y-auto p-6 lg:col-start-1 lg:row-start-2">

                {files.map((file) => (

                    <div
                        key={file.id}
                        className="flex min-w-0 flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >

                        {/* LEFT */}

                        <div className="flex min-w-0 flex-1 gap-5">

                            <PdfThumbnail
                                file={file.file}
                                locked={
                                    file.status ===
                                    "password_required"
                                }
                            />

                            <div className="flex flex-col">

                                <h3 className="break-all text-lg font-semibold">

                                    {file.filename}

                                </h3>

                                <p className="mt-2 text-sm text-gray-500">

                                    {file.pages} Pages •{" "}
                                    {(file.size / 1024 / 1024).toFixed(2)} MB

                                </p>

                                {file.message && (

                                    <p className="mt-3 text-sm text-red-600">

                                        {file.message}

                                    </p>

                                )}

                            </div>

                        </div>

                        {/* RIGHT */}

                        <div className="flex w-full flex-col items-end gap-3">

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

                            {/* Invalid */}

                            {!file.skipped &&
                                file.status === "invalid" && (

                                    <span className="rounded-full bg-red-100 px-4 py-2 font-semibold text-red-700">

                                        ❌ Invalid PDF

                                    </span>

                                )}

                            {/* Password Required */}

                            {file.status === "password_required" &&
                                !file.skipped && (

                                    <div className="flex w-full flex-col items-end gap-3">

                                        <span className="rounded-full bg-yellow-100 px-4 py-2 font-semibold text-yellow-700">

                                            🔒 Password Required

                                        </span>

                                        <input
                                            type={
                                                file.showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={
                                                file.password || ""
                                            }
                                            placeholder="Enter password to unlock preview and merge"
                                            autoComplete="off"
                                            spellCheck={false}
                                            onChange={(e) =>
                                                onPasswordChange(
                                                    file.id,
                                                    e.target.value
                                                )
                                            }
                                            onBlur={() =>
                                                onPasswordBlur(
                                                    file.id
                                                )
                                            }
                                            onKeyDown={(e) => {

                                                if (
                                                    e.key === "Enter"
                                                ) {

                                                    e.currentTarget.blur();

                                                }

                                            }}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            aria-label="PDF Password"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onTogglePassword(
                                                    file.id
                                                )
                                            }
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                        >

                                            👁{" "}
                                            {file.showPassword
                                                ? "Hide Password"
                                                : "Show Password"}

                                        </button>

                                    </div>

                                )}

                            {/* Common Actions */}

<div className="flex items-center gap-2">

    {/* Skip / Restore */}

    <button
        type="button"
        onClick={() => onSkipFile(file.id)}
        aria-label={file.skipped ? "Restore PDF" : "Skip PDF"}
        title={file.skipped ? "Restore PDF" : "Skip PDF"}
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
            file.skipped
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
    >
        {file.skipped ? (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
            >
                <path d="M9 14l-4-4 4-4" />
                <path d="M5 10h9a4 4 0 0 1 4 4v1" />
            </svg>
        ) : (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
            >
                <path d="M5 5v14l6-5h8V10h-8L5 5z" />
            </svg>
        )}

        <span className="sr-only">
            {file.skipped ? "Restore PDF" : "Skip PDF"}
        </span>
    </button>

    {/* Remove */}

    <button
        type="button"
        onClick={() => onRemoveFile(file.id)}
        aria-label="Remove PDF"
        title="Remove PDF"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
        >
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
        </svg>

        <span className="sr-only">
            Remove PDF
        </span>
    </button>

</div>

                        </div>

                    </div>

                ))}

            </div>

            {/* =========================
                SUMMARY
            ========================== */}

            <div className="relative flex min-h-0 flex-col border-t bg-gray-50 px-6 py-5 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">

                    <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-gray-700">
                    <div className="mb-1 font-semibold text-gray-900">
                        Merge PDF
                    </div>
                    Review your selected PDFs, then merge when all files are ready.
                </div>
            <div className="grid grid-cols-2 gap-2.5">

                    {/* Total */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-2xl font-bold">

                            {summary.total}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Total

                        </div>

                    </div>

                    {/* Ready */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-3xl font-bold text-green-600">

                            {summary.ready}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Ready

                        </div>

                    </div>

                    {/* Protected */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-3xl font-bold text-yellow-600">

                            {summary.protectedFiles}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Protected

                        </div>

                    </div>

                    {/* Skipped */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-3xl font-bold text-blue-600">

                            {summary.skipped}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Skipped

                        </div>

                    </div>

                    {/* Corrupted */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-3xl font-bold text-red-600">

                            {summary.corrupted}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Corrupted

                        </div>

                    </div>

                    {/* Invalid */}

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">

                        <div className="text-3xl font-bold text-red-600">

                            {summary.invalid}

                        </div>

                        <div className="mt-1 text-sm text-gray-500">

                            Invalid

                        </div>

                    </div>

                </div>

            
                {/* Merge Button */}

                <div className="mt-auto pt-6">

                    <button
                        type="button"
                        disabled={!canMerge}
                        onClick={onUnlockMerge}
                        className={`w-full rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition ${
                            !canMerge
                                ? "cursor-not-allowed bg-gray-400"
                                : "bg-red-600 hover:bg-red-700"
                        }`}
                    >
                        &#128275; Unlock & Merge
                    </button>

                </div>
</div>

        </div>

    );

}