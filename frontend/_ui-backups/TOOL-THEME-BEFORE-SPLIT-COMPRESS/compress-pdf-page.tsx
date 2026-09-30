"use client";

import { useRef, useState } from "react";
import { FileText, ShieldCheck, UploadCloud, X } from "lucide-react";

import { CompressPdfProcessor } from "@/engine/processing/processors/CompressPdfProcessor";
import type { ProcessingContext } from "@/engine/processing/ProcessingContext";
import type { WorkspaceFile } from "@/engine/processing/WorkspaceFile";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

export default function CompressPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const toast = useToast();

  const [workspaceFile, setWorkspaceFile] =
    useState<WorkspaceFile | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [isDragActive, setIsDragActive] =
    useState(false);

  const MAX_FILE_SIZE =
    ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

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

  const rejectFile = () => {
    setWorkspaceFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFile = (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_SIZE) {
      rejectFile();

      toast.error({
        title: "File too large",
        message: `"${selectedFile.name}" is larger than ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB. The maximum allowed file size is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB per PDF.`,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      return;
    }

    const workspace: WorkspaceFile = {
      id: crypto.randomUUID(),
      file: selectedFile,
      filename: selectedFile.name,
      extension: ".pdf",
      size: selectedFile.size,
      pages: 0,
      status: "ready",
      encrypted: false,
      corrupted: false,
      password: "",
      showPassword: false,
      skipped: false,
    };

    setWorkspaceFile(workspace);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    handleFile(files[0]);
  };

  const handleWorkspaceDragEnter = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      loading ||
      !event.dataTransfer.types.includes("Files")
    ) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleWorkspaceDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      !loading &&
      event.dataTransfer.types.includes("Files")
    ) {
      event.dataTransfer.dropEffect = "copy";
      setIsDragActive(true);
    }
  };

  const handleWorkspaceDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current -= 1;

    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleWorkspaceDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = 0;
    setIsDragActive(false);

    if (loading) {
      return;
    }

    const files = Array.from(
      event.dataTransfer.files ?? []
    );

    if (files.length === 0) {
      return;
    }

    handleFile(files[0]);
  };

  const handleCompress = async () => {
    if (!workspaceFile) {
      toast.warning({
        title: "No PDF selected",
        message: "Please add a PDF to compress.",
      });

      return;
    }

    setLoading(true);

    try {
      const context: ProcessingContext = {
        files: [workspaceFile],
        toolType: "compress",
      };

      const processor =
        new CompressPdfProcessor();

      const result =
        await processor.process(context);

      if (
        !result.success ||
        !result.outputFile
      ) {
        toast.error({
          title: "Compression failed",
          message:
            result.error ||
            "Unable to compress the PDF.",
        });

        return;
      }

      const url =
        window.URL.createObjectURL(
          result.outputFile
        );

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        result.outputFile.name ||
        "compressed.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success({
        title: "Compression completed",
        message:
          "Your PDF was compressed successfully.",
      });

      setWorkspaceFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      console.warn(
        "Compress PDF failed:",
        error
      );

      toast.error({
        title: "Compression failed",
        message:
          error instanceof Error &&
          error.message.length > 0
            ? error.message
            : "Unable to compress PDF.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fileName =
    workspaceFile?.filename ||
    workspaceFile?.file?.name;

  const fileSizeMb =
    workspaceFile?.file?.size
      ? (
          workspaceFile.file.size /
          (1024 * 1024)
        ).toFixed(2)
      : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Compress PDF
          </h1>

          <p className="mt-3 text-base text-gray-600 sm:text-lg">
            Reduce PDF size while maintaining quality.
          </p>
        </div>

        <div
          className="relative mt-1 grid h-[calc(100svh-205px)] min-h-[500px] w-full max-w-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)] lg:grid-cols-[minmax(0,1fr)_320px]"
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
                  <UploadCloud
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {isDragActive
                    ? "Drop your PDF here"
                    : "Drop a PDF here"}
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
                    {workspaceFile
                      ? "PDF ready to compress"
                      : "Add one PDF to begin"}
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
                    <FileText
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {fileName}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {fileSizeMb
                        ? `${fileSizeMb} MB`
                        : "PDF file"}{" "}
                      · Ready
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
                    <X
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    Your selected PDF will appear here.
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    One PDF per compression operation.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Compress PDF
              </p>

              <h2 className="mt-1 text-base font-bold text-slate-950">
                {workspaceFile
                  ? "Ready to compress"
                  : "Waiting for a PDF"}
              </h2>

              <p className="mt-2 text-sm leading-5 text-slate-600">
                Add one PDF and compress it in one step.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  File
                </p>

                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {workspaceFile
                    ? "1 PDF"
                    : "—"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Status
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {loading
                    ? "Compressing…"
                    : workspaceFile
                      ? "Ready"
                      : "Waiting"}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4">
              {workspaceFile && (
                <button
                  type="button"
                  onClick={handleCompress}
                  disabled={loading}
                  className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {loading ? "Compressing…" : "Compress PDF"}
                </button>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-4 text-slate-600">
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />

                <span>
                  Your PDF is processed securely.
                </span>
              </div>
            </div>
          </aside>

          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-red-400 bg-red-50/20" />
          )}
        </div>
      </div>
    </main>
  );
}

