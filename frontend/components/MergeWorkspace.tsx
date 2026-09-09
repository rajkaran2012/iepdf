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
                        className="flex items-start justify-between gap-6 px-8 py-6"
                    >

                        {/* LEFT */}

                        <div className="flex flex-1 gap-6">

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

                        <div className="flex w-80 flex-col items-end gap-4">

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

                            <div className="flex gap-2">

                                <button
                                    type="button"
                                    onClick={() =>
                                        onSkipFile(
                                            file.id
                                        )
                                    }
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                        file.skipped
                                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >

                                    {file.skipped
                                        ? "↩ Restore"
                                        : "⏭ Skip"}

                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        onRemoveFile(
                                            file.id
                                        )
                                    }
                                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                                >

                                    🗑 Remove

                                </button>

                            </div>

                        </div>

                    </div>

                ))}

            </div>

            {/* =========================
                SUMMARY
            ========================== */}

            <div className="border-t bg-gray-50 px-8 py-8">

                <div className="grid grid-cols-6 gap-6">

                    {/* Total */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold">

                            {summary.total}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Total

                        </div>

                    </div>

                    {/* Ready */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold text-green-600">

                            {summary.ready}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Ready

                        </div>

                    </div>

                    {/* Protected */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold text-yellow-600">

                            {summary.protectedFiles}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Protected

                        </div>

                    </div>

                    {/* Skipped */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold text-blue-600">

                            {summary.skipped}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Skipped

                        </div>

                    </div>

                    {/* Corrupted */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold text-red-600">

                            {summary.corrupted}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Corrupted

                        </div>

                    </div>

                    {/* Invalid */}

                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">

                        <div className="text-3xl font-bold text-red-600">

                            {summary.invalid}

                        </div>

                        <div className="mt-2 text-gray-500">

                            Invalid

                        </div>

                    </div>

                </div>

                {/* Merge Button */}

                <div className="mt-8 flex justify-center">

                    <button
                        type="button"
                        disabled={
                            !canMerge
                        }
                        onClick={
                            onUnlockMerge
                        }
                        className={`rounded-2xl px-10 py-4 text-lg font-semibold text-white transition ${
                            !canMerge
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