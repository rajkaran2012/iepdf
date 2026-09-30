"use client";

import { useRef, useState } from "react";

import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { PdfToJpgProcessor } from "@/engine/processing/processors/PdfToJpgProcessor";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

import ToolLayout from "@/components/layout/ToolLayout";

const MAX_FILE_SIZE =
    ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

export default function PdfToJpg() {
    const inputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const [workspaceFile, setWorkspaceFile] =
        useState<any | null>(null);

    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleSelectFile = () => {
        if (!loading) {
            inputRef.current?.click();
        }
    };

    const processSelectedFile = async (selectedFile: File) => {
        if (
            selectedFile.size >
            MAX_FILE_SIZE
        ) {
            toast.error({
                title: "File too large",
                message:
                    `"${selectedFile.name}" is larger than 15 MiB. The maximum allowed file size is 15 MiB per PDF.`,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
            });

            setWorkspaceFile(null);
            return;
        }

        try {
            const analyzer = new BrowserPdfAnalyzer();

            const analysis = await analyzer.analyzeMany([
                selectedFile,
            ]);

            const result = analysis[0];

            if (!result) {
                toast.error({
                    title: "Unable to analyze PDF",
                    message:
                        "We couldn't read the selected PDF.",
                });

                return;
            }

            setWorkspaceFile({
                ...result,
                file: selectedFile,
                password: "",
                showPassword: false,
                skipped: false,
            });
        } catch (error: unknown) {
            toast.error({
                title: "PDF analysis failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to analyze the selected PDF.",
            });
        }
    };

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(
            event.target.files ?? []
        );

        if (files.length === 0) {
            return;
        }

        await processSelectedFile(files[0]);

        event.target.value = "";
    };

    const handleDrop = async (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        event.stopPropagation();

        setDragging(false);

        if (loading) {
            return;
        }

        const files = Array.from(
            event.dataTransfer.files ?? []
        );

        if (files.length === 0) {
            return;
        }

        await processSelectedFile(files[0]);
    };

    const handleRemove = () => {
        if (loading) {
            return;
        }

        setWorkspaceFile(null);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const handleConvert = async () => {
        if (!workspaceFile) {
            toast.warning({
                title: "No PDF selected",
                message:
                    "Please select a PDF to convert.",
            });

            return;
        }

        setLoading(true);

        try {
            const processor = new PdfToJpgProcessor();

            const result = await processor.process({
                files: [workspaceFile],
                toolType: "pdf-to-jpg",
            });

            if (
                !result.success ||
                !result.outputFile
            ) {
                toast.error({
                    title: "Conversion failed",
                    message:
                        result.error ||
                        "Unable to convert the PDF to JPG.",
                });

                return;
            }

            const url = URL.createObjectURL(
                result.outputFile
            );

            const link = document.createElement("a");

            link.href = url;
            link.download = result.outputFile.name;

            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);

            toast.success({
                title: "Conversion completed",
                message:
                    "Your PDF was converted to JPG successfully. ZIP downloaded.",
            });

            setWorkspaceFile(null);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        } catch (error: unknown) {
            toast.error({
                title: "Conversion failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to convert the PDF to JPG.",
            });
        } finally {
            setLoading(false);
        }
    };

    const fileSize = workspaceFile?.file?.size
        ? `${(
              workspaceFile.file.size /
              1024 /
              1024
          ).toFixed(2)} MB`
        : "";

    return (
        <ToolLayout
            title="PDF to JPG"
            description="Convert PDF pages into high-quality JPG images."
            wide
        >
            <div className="mx-auto w-full max-w-4xl">
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {/* Tool identity */}
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-[10px] font-bold text-red-600">
                                PDF
                            </span>

                            <span className="text-sm font-medium text-gray-800">
                                PDF
                            </span>
                        </div>

                        <svg
                            className="h-5 w-5 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 12h14m-5-5 5 5-5 5"
                            />
                        </svg>

                        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                                JPG
                            </span>

                            <span className="text-sm font-medium text-gray-800">
                                JPG
                            </span>
                        </div>
                    </div>

                    <p className="mt-3 max-w-xl text-sm text-gray-500">
                        Convert every PDF page into a JPG image.
                    </p>
                </div>

                {!workspaceFile ? (
                    <>
                        {/* Add file action */}
                        <div className="mb-3 flex justify-center">
                            <button
                                type="button"
                                onClick={handleSelectFile}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-purple-700 hover:shadow-md active:translate-y-px focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 5v14M5 12h14"
                                    />
                                </svg>

                                Add PDF File
                            </button>
                        </div>

                        <p className="mb-3 text-center text-sm text-gray-500">
                            or drag and drop a PDF file below
                        </p>

                        {/* Drop zone */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Drop a PDF file here or press Enter to browse"
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                ) {
                                    event.preventDefault();
                                    handleSelectFile();
                                }
                            }}
                            onDragEnter={(event) => {
                                event.preventDefault();
                                event.stopPropagation();

                                if (!loading) {
                                    setDragging(true);
                                }
                            }}
                            onDragOver={(event) => {
                                event.preventDefault();
                                event.stopPropagation();

                                if (!loading) {
                                    setDragging(true);
                                }
                            }}
                            onDragLeave={(event) => {
                                event.preventDefault();
                                event.stopPropagation();

                                if (
                                    event.currentTarget ===
                                    event.target
                                ) {
                                    setDragging(false);
                                }
                            }}
                            onDrop={handleDrop}
                            onClick={(event) => {
                                if (
                                    event.target ===
                                    event.currentTarget
                                ) {
                                    handleSelectFile();
                                }
                            }}
                            className={[
                                "flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center outline-none transition-all",
                                "focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
                                dragging
                                    ? "border-purple-500 bg-purple-50"
                                    : "border-gray-300 bg-white hover:border-gray-400",
                            ].join(" ")}
                        >
                            <div
                                className={[
                                    "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl",
                                    dragging
                                        ? "bg-purple-100"
                                        : "bg-gray-100",
                                ].join(" ")}
                            >
                                <svg
                                    className={[
                                        "h-9 w-9",
                                        dragging
                                            ? "text-purple-600"
                                            : "text-gray-600",
                                    ].join(" ")}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M7 18h10a4 4 0 0 0 .6-7.955A6 6 0 0 0 6.2 8.2 5 5 0 0 0 7 18Z"
                                    />

                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 9v7m0-7-3 3m3-3 3 3"
                                    />
                                </svg>
                            </div>

                            <h2 className="text-xl font-semibold text-gray-900">
                                Drop your PDF here
                            </h2>

                            <p className="mt-2 text-sm text-gray-500">
                                Drag and drop a PDF file here
                            </p>

                            <p className="mt-5 text-xs text-gray-400">
                                PDF · Maximum 15 MiB
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        {/* Selected file */}
                        <div className="p-6">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-600">
                                        PDF
                                    </div>

                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-gray-900">
                                            {workspaceFile.filename}
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500">
                                            PDF document
                                            {fileSize
                                                ? ` · ${fileSize}`
                                                : ""}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        disabled={loading}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Remove
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSelectFile}
                                        disabled={loading}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Change PDF
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Output information */}
                        <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Output format
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        JPG images · All PDF pages
                                    </p>
                                </div>

                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-[9px] font-bold text-blue-600">
                                        JPG
                                    </span>

                                    JPG
                                </div>
                            </div>
                        </div>

                        {/* Primary action */}
                        <div className="p-6">
                            <button
                                type="button"
                                onClick={handleConvert}
                                disabled={loading}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-purple-700 hover:shadow-md active:translate-y-px focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            aria-hidden="true"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />

                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                            />
                                        </svg>

                                        Converting...
                                    </>
                                ) : (
                                    "Convert to JPG"
                                )}
                            </button>

                            <p className="mt-3 text-center text-xs text-gray-400">
                                Each PDF page will be included in the downloaded ZIP.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
}
