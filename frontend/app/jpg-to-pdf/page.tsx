"use client";

import { useRef, useState } from "react";

import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { JpgToPdfProcessor } from "@/engine/processing/processors/JpgToPdfProcessor";

import ToolLayout from "@/components/layout/ToolLayout";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

const MAX_FILE_SIZE = ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

export default function JpgToPdf() {
    const toast = useToast();
    const inputRef =
        useRef<HTMLInputElement>(null);

    const [workspaceFiles, setWorkspaceFiles] =
        useState<any[]>([]);

    const [loading, setLoading] =
        useState(false);
    const handleSelectFiles = () => {
        inputRef.current?.click();
    };

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles =
            Array.from(
                event.target.files ?? []
            );

        if (selectedFiles.length === 0) {
            return;
        }

        for (const file of selectedFiles) {
            if (file.size > MAX_FILE_SIZE) {
                toast.error({
                    title: "File too large",
                    message: `"${file.name}" is larger than 15 MB. The maximum allowed file size is 15 MB per image.`,
                    fileName: file.name,
                    fileSize: file.size,
                });

                event.target.value = "";
                setWorkspaceFiles([]);

                return;
            }
        }

        try {
            const analyzer =
                new BrowserPdfAnalyzer();

            const analyzedFiles =
                selectedFiles.map(file => ({
                    id:
                        typeof crypto !== "undefined" &&
                        typeof crypto.randomUUID === "function"
                            ? crypto.randomUUID()
                            : `${file.name}-${file.size}-${file.lastModified}`,

                    file,

                    filename: file.name,

                    extension:
                        file.name
                            .split(".")
                            .pop()
                            ?.toLowerCase() || "",

                    size: file.size,

                    pages: 0,

                    status: "ready",

                    encrypted: false,

                    corrupted: false,

                    password: "",

                    showPassword: false,

                    skipped: false,
                }));

            const workspace =
                analyzedFiles.map(file => ({
                    ...file,
                }));

            setWorkspaceFiles(workspace);
        } catch (error: unknown) {

            toast.error({
                title: "JPG selection failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to prepare the selected images.",
            });
        }
    };

    const handleConvert = async () => {
        if (workspaceFiles.length === 0) {
            toast.warning({
                title: "No JPG images selected",
                message: "Please select JPG images to convert.",
            });

            return;
        }

        setLoading(true);

        try {
            const processor =
                new JpgToPdfProcessor();

            const result =
                await processor.process({
                    files: workspaceFiles,
                    toolType: "jpg-to-pdf",
                });

            if (
                !result.success ||
                !result.outputFile
            ) {
                toast.error({
                    title: "Conversion failed",
                    message:
                        result.error ||
                        "Unable to convert the images to PDF.",
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
                message: "Images converted to PDF successfully. PDF downloaded.",
            });

            setWorkspaceFiles([]);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        } catch (error: unknown) {

            toast.error({
                title: "Conversion failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to convert the images to PDF.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <ToolLayout
            title="JPG to PDF"
            description="Convert JPG images into a single PDF securely and instantly."
        >
            <div className="flex flex-col items-center justify-center py-16">
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <button
                    type="button"
                    onClick={handleSelectFiles}
                    disabled={loading}
                    className="rounded-xl bg-orange-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Select JPG Images
                </button>

                {workspaceFiles.length > 0 && (
                    <div className="mt-8 w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-3 text-lg font-semibold">
                            Selected Images
                        </h3>

                        <div className="mb-6 space-y-2">
                            {workspaceFiles.map(
                                (workspaceFile, index) => (
                                    <div
                                        key={
                                            workspaceFile.id ||
                                            index
                                        }
                                        className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700"
                                    >
                                        {workspaceFile.filename}
                                    </div>
                                )
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleConvert}
                            disabled={loading}
                            className="w-full rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Converting..."
                                : "Convert to PDF"}
                        </button>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
}
