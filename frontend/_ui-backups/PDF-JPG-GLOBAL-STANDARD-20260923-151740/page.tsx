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

    const [loading, setLoading] =
        useState(false);

    const [dragging, setDragging] =
        useState(false);

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
                message: `"${selectedFile.name}" is larger than 15 MB. The maximum allowed file size is 15 MB per PDF.`,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
            });

            setWorkspaceFile(null);
            return;
        }

        try {
            const analyzer =
                new BrowserPdfAnalyzer();

            const analysis =
                await analyzer.analyzeMany([
                    selectedFile,
                ]);

            const result = analysis[0];

            if (!result) {
                toast.error({
                    title: "Unable to analyze PDF",
                    message: "We couldn't read the selected PDF.",
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
        const files =
            Array.from(
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

        const files =
            Array.from(
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
                message: "Please select a PDF to convert.",
            });

            return;
        }

        setLoading(true);

        try {
            const processor =
                new PdfToJpgProcessor();

            const result =
                await processor.process({
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

            const url =
                URL.createObjectURL(
                    result.outputFile
                );

            const link =
                document.createElement("a");

            link.href = url;
            link.download =
                result.outputFile.name;

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

    const fileSize =
        workspaceFile?.file?.size
            ? `${(
                  workspaceFile.file.size /
                  1024 /
                  1024
              ).toFixed(2)} MB`
            : "";

    return (
        <ToolLayout
            title="PDF to JPG"
            description="Convert PDF pages into JPG images securely and instantly."
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

                {!workspaceFile ? (
                    <div
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
                        className={[
                            "flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all",
                            dragging
                                ? "border-purple-500 bg-purple-50"
                                : "border-gray-300 bg-white hover:border-gray-400",
                        ].join(" ")}
                    >
                        <div
                            className={[
                                "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
                                dragging
                                    ? "bg-purple-100"
                                    : "bg-gray-100",
                            ].join(" ")}
                        >
                            <svg
                                className={[
                                    "h-8 w-8",
                                    dragging
                                        ? "text-purple-600"
                                        : "text-gray-500",
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
                            {dragging
                                ? "Drop your PDF here"
                                : "Drop your PDF here"}
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            or select a PDF from your computer
                        </p>

                        <button
                            type="button"
                            onClick={handleSelectFile}
                            disabled={loading}
                            className="mt-6 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Select PDF
                        </button>

                        <p className="mt-5 text-xs text-gray-400">
                            PDF only · Maximum 15 MB
                        </p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Remove
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSelectFile}
                                    disabled={loading}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Change PDF
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-gray-100 pt-6">
                            <button
                                type="button"
                                onClick={handleConvert}
                                disabled={loading}
                                className="w-full rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading
                                    ? "Converting..."
                                    : "Convert to JPG"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
}
