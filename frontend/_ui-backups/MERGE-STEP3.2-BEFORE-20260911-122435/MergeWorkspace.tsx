"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

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

    onAddFiles: () => void;

    onReorderFiles: (
        draggedId: string,
        targetId: string
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

    onAddFiles,

    onReorderFiles,

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

    const [draggedFileId, setDraggedFileId] = useState<string | null>(null);

    const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

    const handleDragStart = (
        event: React.DragEvent<HTMLDivElement>,
        id: string
    ) => {

        setDraggedFileId(id);
        setDragOverFileId(null);

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
            "text/plain",
            id
        );

    };

    const handleDragOver = (
        event: React.DragEvent<HTMLDivElement>,
        id: string
    ) => {

        event.preventDefault();

        if (
            draggedFileId &&
            draggedFileId !== id
        ) {
            setDragOverFileId(id);
            event.dataTransfer.dropEffect = "move";
        }

    };

    const handleDragLeave = (
        event: React.DragEvent<HTMLDivElement>
    ) => {

        const currentTarget = event.currentTarget;

        if (
            event.relatedTarget instanceof Node &&
            currentTarget.contains(event.relatedTarget)
        ) {
            return;
        }

        setDragOverFileId(null);

    };

    const handleDrop = (
        event: React.DragEvent<HTMLDivElement>,
        targetId: string
    ) => {

        event.preventDefault();

        const draggedId =
            event.dataTransfer.getData("text/plain") ||
            draggedFileId;

        if (
            draggedId &&
            draggedId !== targetId
        ) {
            onReorderFiles(
                draggedId,
                targetId
            );
        }

        setDraggedFileId(null);
        setDragOverFileId(null);

    };

    const handleDragEnd = () => {

        setDraggedFileId(null);
        setDragOverFileId(null);

    };
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

            <div className="min-h-0 overflow-y-auto p-4 lg:col-start-1 lg:row-start-2">

                <div className="space-y-3">

                    {files.map((file, index) => (

                        <div
                            key={file.id}
                            onDragOver={(event) =>
                                handleDragOver(event, file.id)
                            }
                            onDragLeave={handleDragLeave}
                            onDrop={(event) =>
                                handleDrop(event, file.id)
                            }
                            className={`rounded-2xl border bg-white shadow-sm transition ${
                                dragOverFileId === file.id
                                    ? "border-blue-400 ring-2 ring-blue-100"
                                    : ""
                            } ${
                                file.skipped
                                    ? "border-gray-200 opacity-65"
                                    : file.status === "password_required"
                                        ? "border-yellow-200"
                                        : file.status === "corrupted" ||
                                          file.status === "invalid"
                                            ? "border-red-200"
                                            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                            }`}
                        >

                            {/* COMPACT FILE ROW */}

                            <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">

                                {/* DRAG HANDLE */}

                                <div
                                    draggable
                                    onDragStart={(event) =>
                                        handleDragStart(
                                            event,
                                            file.id
                                        )
                                    }
                                    onDragEnd={handleDragEnd}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Drag PDF ${index + 1} to reorder`}
                                    title="Drag to reorder"
                                    className={`flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing ${
                                        draggedFileId === file.id
                                            ? "bg-blue-50 text-blue-600"
                                            : ""
                                    }`}
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>

                                {/* ORDER */}

                                <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600"
                                    aria-label={`PDF ${index + 1}`}
                                >
                                    {index + 1}
                                </div>

                                {/* THUMBNAIL */}

                                <div className="shrink-0">
                                    <PdfThumbnail
                                        file={file.file}
                                        locked={
                                            file.status ===
                                            "password_required"
                                        }
                                        width={76}
                                    />
                                </div>

                                {/* FILE INFORMATION */}

                                <div className="min-w-0 flex-1">

                                    <div className="flex min-w-0 items-center gap-2">

                                        <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">
                                            {file.filename}
                                        </h3>

                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">

                                        <span>
                                            {file.pages} Pages
                                        </span>

                                        <span aria-hidden="true">
                                            &#8226;
                                        </span>

                                        <span>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>

                                    </div>

                                    {file.message && (

                                        <p className="mt-1 truncate text-xs text-red-600">
                                            {file.message}
                                        </p>

                                    )}

                                </div>

                                {/* STATUS */}

                                <div className="hidden shrink-0 sm:block">

                                    {file.skipped && (

                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                            &#9654; Skipped
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "ready" && (

                                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                                            &#10003; Ready
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "corrupted" && (

                                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                            &#10005; Corrupted
                                        </span>

                                    )}

                                    {!file.skipped &&
                                        file.status === "invalid" && (

                                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                            &#10005; Invalid PDF
                                        </span>

                                    )}

                                    {file.status === "password_required" &&
                                        !file.skipped && (

                                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                                            &#128274; Password Required
                                        </span>

                                    )}

                                </div>

                                {/* ACTIONS */}

                                <div className="flex shrink-0 items-center gap-1.5">

                                    {/* SKIP / RESTORE */}

                                    <button
                                        type="button"
                                        onClick={() => onSkipFile(file.id)}
                                        aria-label={
                                            file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"
                                        }
                                        title={
                                            file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"
                                        }
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
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
                                                className="h-4.5 w-4.5"
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
                                                className="h-4.5 w-4.5"
                                                aria-hidden="true"
                                            >
                                                <path d="M5 5v14l6-5h8V10h-8L5 5z" />
                                            </svg>

                                        )}

                                        <span className="sr-only">
                                            {file.skipped
                                                ? "Restore PDF"
                                                : "Skip PDF"}
                                        </span>

                                    </button>

                                    {/* REMOVE */}

                                    <button
                                        type="button"
                                        onClick={() => onRemoveFile(file.id)}
                                        aria-label="Remove PDF"
                                        title="Remove PDF"
                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
                                    >

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="h-4.5 w-4.5"
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

                            {/* MOBILE STATUS */}

                            <div className="px-4 pb-3 sm:hidden">

                                {file.skipped && (

                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                        &#9654; Skipped
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "ready" && (

                                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                                        &#10003; Ready
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "corrupted" && (

                                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                        &#10005; Corrupted
                                    </span>

                                )}

                                {!file.skipped &&
                                    file.status === "invalid" && (

                                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                                        &#10005; Invalid PDF
                                    </span>

                                )}

                                {file.status === "password_required" &&
                                    !file.skipped && (

                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                                        &#128274; Password Required
                                    </span>

                                )}

                            </div>


                            {/* PROTECTED PDF CONTROLS */}

                            {file.status === "password_required" &&
                                !file.skipped && (

                                <div className="border-t border-yellow-100 bg-yellow-50/40 px-4 py-2.5">

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                                        <div className="min-w-0 flex-1">

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
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                aria-label="PDF Password"
                                            />

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onTogglePassword(
                                                    file.id
                                                )
                                            }
                                            className="shrink-0 self-end rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-800 sm:self-auto"
                                        >

                                            &#128065;{" "}
                                            {file.showPassword
                                                ? "Hide Password"
                                                : "Show Password"}

                                        </button>

                                    </div>

                                </div>

                            )}
                        </div>

                    ))}

                </div>

            </div>
            {/* =========================
                SUMMARY
            ========================== */}

            <div className="relative flex min-h-0 flex-col border-t bg-gray-50 px-6 py-5 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">

                    <button
  type="button"
  onClick={onAddFiles}
  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
>
  <span aria-hidden="true" className="text-lg leading-none">+</span>
  Add More PDFs
</button>
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
