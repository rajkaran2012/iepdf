"use client";

import { useRef, useState } from "react";

import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { PdfToJpgProcessor } from "@/engine/processing/processors/PdfToJpgProcessor";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

import ToolLayout from "@/components/layout/ToolLayout";

const MAX_FILE_SIZE = ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

export default function PdfToJpg() {    const inputRef = useRef<HTMLInputElement>(null);

    const toast = useToast();

    const [workspaceFile, setWorkspaceFile] =
        useState<any | null>(null);

    const [loading, setLoading] =
        useState(false);const handleSelectFile = () => {
        inputRef.current?.click();
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




        const selectedFile = files[0];

        if (
            selectedFile.size >
            MAX_FILE_SIZE
        ) {
            toast.error({ title: "File too large", message: `"${selectedFile.name}" is larger than 15 MB. The maximum allowed file size is 15 MB per PDF.`, fileName: selectedFile.name, fileSize: selectedFile.size });

            event.target.value = "";
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
                toast.error({ title: "Unable to analyze PDF", message: "We couldn't read the selected PDF." });

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

            toast.error({ title: "PDF analysis failed", message: error instanceof Error ? error.message : "Unable to analyze the selected PDF." });
        }
    };

    const handleConvert = async () => {
        if (!workspaceFile) {
            toast.warning({ title: "No PDF selected", message: "Please select a PDF to convert." });

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
                toast.error({ title: "Conversion failed", message: result.error || "Unable to convert the PDF to JPG." });

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

            toast.success({ title: "Conversion completed", message: "Your PDF was converted to JPG successfully. ZIP downloaded." });

            setWorkspaceFile(null);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        } catch (error: unknown) {

            toast.error({ title: "Conversion failed", message: error instanceof Error ? error.message : "Unable to convert the PDF to JPG." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <ToolLayout
            title="PDF to JPG"
            description="Convert PDF pages into JPG images securely and instantly."
        >
            <div className="flex flex-col items-center justify-center py-16">
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <button
                    type="button"
                    onClick={handleSelectFile}
                    disabled={loading}
                    className="rounded-xl bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Select PDF
                </button>

                {workspaceFile && (
                    <div className="mt-8 w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-3 text-lg font-semibold">
                            Selected File
                        </h3>

                        <div className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                            {workspaceFile.filename}
                        </div>

                        <button
                            type="button"
                            onClick={handleConvert}
                            disabled={loading}
                            className="w-full rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Converting..."
                                : "Convert to JPG"}
                        </button>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
}
