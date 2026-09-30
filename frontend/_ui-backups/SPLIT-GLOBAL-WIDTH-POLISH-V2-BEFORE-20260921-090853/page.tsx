"use client";

import { useRef, useState } from "react";
import { FileText, ShieldCheck, UploadCloud, X } from "lucide-react";

import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { SplitPdfProcessor } from "@/engine/processing/processors/SplitPdfProcessor";
import ValidationConstants from "@/engine/validation/common/validationConstants";
import useToast from "@/hooks/useToast";

import ToolLayout from "@/components/layout/ToolLayout";

export default function SplitPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const toast = useToast();

  const [workspaceFile, setWorkspaceFile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleSelectFile = () => {
    if (!loading) {
      fileInputRef.current?.click();
    }
  };

  const clearWorkspaceFile = () => {
    if (loading) {
      return;
    }

    setWorkspaceFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFile = async (selectedFile: File) => {
    const rejectFile = () => {
      setWorkspaceFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    if (
      selectedFile.size >
      ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES
    ) {
      rejectFile();

      toast.error({
        title: "File too large",
        message: "The selected PDF exceeds the 15 MB limit.",
      });
      return;
    }

    const extensionIndex = selectedFile.name.lastIndexOf(".");
    const extension =
      extensionIndex >= 0
        ? selectedFile.name.slice(extensionIndex).toLowerCase()
        : "";

    const allowedExtensions =
      ValidationConstants.BOUNDARY_VALIDATION.ALLOWED_EXTENSIONS;

    if (!allowedExtensions.includes(extension)) {
      rejectFile();

      toast.error({
        title: "Invalid file type",
        message: "Only PDF files are allowed.",
      });
      return;
    }

    const signatureLength =
      ValidationConstants.BOUNDARY_VALIDATION.PDF_MAGIC_NUMBER_LENGTH;

    const headerBytes = new Uint8Array(
      await selectedFile.slice(0, signatureLength).arrayBuffer()
    );

    const header = new TextDecoder("ascii").decode(headerBytes);

    if (
      header !==
      ValidationConstants.BOUNDARY_VALIDATION.PDF_MAGIC_NUMBER
    ) {
      rejectFile();

      toast.error({
        title: "Invalid PDF",
        message: "Only valid PDF files are allowed.",
      });
      return;
    }

    const analyzer = new BrowserPdfAnalyzer();
    const analysis = await analyzer.analyzeMany([selectedFile]);
    const result = analysis[0];

    if (!result) {
      rejectFile();

      toast.error({
        title: "Unable to analyze PDF",
        message: "We couldn't read the selected PDF.",
      });
      return;
    }

    // Admission rule:
    // Only analyzer status "ready" may populate workspaceFile.
    // This guarantees that the Ready label and enabled Split button
    // can only occur for a genuinely accepted PDF.
    if (result.status !== "ready") {
      rejectFile();

      if (result.status === "password_required") {
        toast.error({
          title: "Password-protected PDF",
          message:
            "This PDF is password-protected and cannot be split until it is unlocked.",
        });
      } else {
        toast.error({
          title: "Invalid PDF",
          message:
            "This PDF appears to be damaged or invalid. Please choose another PDF.",
        });
      }

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

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    await handleFile(files[0]);
  };

  const handleWorkspaceDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (loading || !event.dataTransfer.types.includes("Files")) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleWorkspaceDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!loading && event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setIsDragActive(true);
    }
  };

  const handleWorkspaceDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current -= 1;

    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleWorkspaceDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = 0;
    setIsDragActive(false);

    if (loading) {
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);

    if (files.length === 0) {
      return;
    }

    await handleFile(files[0]);
  };

  const handleSplitPDF = async () => {
    if (!workspaceFile) {
      toast.warning({
        title: "No PDF selected",
        message: "Please add a PDF to split.",
      });
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
        toast.error({
          title: "Split failed",
          message: result.error || "Unable to split the PDF.",
        });
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

      toast.success({
        title: "Split completed",
        message: "Your PDF was split successfully. ZIP downloaded.",
      });

      setWorkspaceFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      toast.error({
        title: "Split failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to split the PDF.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fileName = workspaceFile?.filename || workspaceFile?.file?.name;
  const fileSizeMb = workspaceFile?.file?.size
    ? (workspaceFile.file.size / (1024 * 1024)).toFixed(2)
    : null;

  return (
    <ToolLayout
      title="Split PDF"
      description="Split a PDF into separate PDF files securely and instantly."
    >
      <div
        className="relative -mx-2 mt-1 grid h-auto min-h-[620px] lg:h-[calc(100svh-360px)] lg:min-h-[390px] w-auto max-w-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)] sm:-mx-3 lg:-mx-4 lg:grid-cols-[minmax(0,1fr)_320px]"
        onDragEnter={handleWorkspaceDragEnter}
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={handleWorkspaceDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <section className="min-w-0 overflow-auto p-4 sm:p-5 lg:p-6">
          <div
            className={`flex min-h-[128px] items-center justify-center rounded-xl border border-dashed px-4 py-3.5 text-center transition sm:min-h-[136px] sm:px-5 ${
              isDragActive
                ? "border-red-400 bg-red-50/70"
                : "border-slate-300 bg-slate-50/70"
            }`}
          >
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm ring-1 ring-slate-200">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </div>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {isDragActive ? "Drop your PDF here" : "Drop a PDF here"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Drag and drop anywhere in this workspace · Max 15 MB
              </p>

              <button
                type="button"
                onClick={handleSelectFile}
                disabled={loading}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add PDF File
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  PDF workspace
                </p>
                <h2 className="mt-1 text-base font-bold text-slate-950">
                  {workspaceFile ? "PDF ready to split" : "Add one PDF to begin"}
                </h2>
              </div>

              <FileText
                className="h-5 w-5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
            </div>

            {workspaceFile ? (
              <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-slate-200">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fileSizeMb ? `${fileSizeMb} MB` : "PDF file"} · Ready
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearWorkspaceFile}
                  disabled={loading}
                  aria-label="Remove selected PDF"
                  title="Remove PDF"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Your selected PDF will appear here.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  One PDF per split operation.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Split PDF
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-950">
              {workspaceFile ? "Ready to split" : "Waiting for a PDF"}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              Add one PDF and split it into separate PDF files in one step.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                File
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {workspaceFile ? "1 PDF" : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {loading ? "Splitting…" : workspaceFile ? "Ready" : "Waiting"}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={handleSplitPDF}
              disabled={!workspaceFile || loading}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {loading ? "Splitting…" : "Split PDF"}
            </button>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-4 text-slate-600">
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span>Files are processed securely in your browser.</span>
            </div>
          </div>
        </aside>

        {isDragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-red-400 bg-red-50/20" />
        )}
      </div>
    </ToolLayout>
  );
}