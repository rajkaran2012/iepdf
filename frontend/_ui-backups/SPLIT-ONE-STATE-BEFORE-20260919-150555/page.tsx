"use client";

import { useRef, useState } from "react";

import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { SplitPdfProcessor } from "@/engine/processing/processors/SplitPdfProcessor";
import ValidationConstants from "@/engine/validation/common/validationConstants";
import useToast from "@/hooks/useToast";

import ToolLayout from "@/components/layout/ToolLayout";

export default function SplitPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toast = useToast();

  const [workspaceFile, setWorkspaceFile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const selectedFile = files[0];

    if (selectedFile.size > ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES) {
      toast.error({
        title: "File too large",
        message: "The selected PDF exceeds the 15 MB limit.",
      });

      setWorkspaceFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    const analyzer = new BrowserPdfAnalyzer();

    const analysis = await analyzer.analyzeMany([selectedFile]);

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
  };

  const handleSplitPDF = async () => {
    if (!workspaceFile) {
      toast.warning({ title: "No PDF selected", message: "Please select a PDF to split." });
      return;
    }

    setLoading(true);

    try {
      const processor = new SplitPdfProcessor();

      const result = await processor.process({
        files: [workspaceFile],
        toolType: "split",
      });

      if (!result.success || !result.outputFile) {
        toast.error({ title: "Split failed", message: result.error || "Unable to split the PDF." });
        return;
      }

      const url = URL.createObjectURL(result.outputFile);

      const link = document.createElement("a");

      link.href = url;
      link.download = result.outputFile.name;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      toast.success({ title: "Split completed", message: "Your PDF was split successfully. ZIP downloaded." });

      setWorkspaceFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      toast.error({ title: "Split failed", message: error instanceof Error ? error.message : "Unable to split the PDF." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Split PDF"
      description="Split a PDF into separate PDF files securely and instantly."
    >
      <div className="flex flex-col items-center justify-center py-16">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={handleSelectFile}
          disabled={loading}
          className="rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              onClick={handleSplitPDF}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Splitting..." : "Split PDF"}
            </button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
