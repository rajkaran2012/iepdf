"use client";

import { useRef, useState } from "react";

import { CompressPdfProcessor } from "@/engine/processing/processors/CompressPdfProcessor";

import type { ProcessingContext } from "@/engine/processing/ProcessingContext";
import type { WorkspaceFile } from "@/engine/processing/WorkspaceFile";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

export default function CompressPDF() {

  const inputRef = useRef<HTMLInputElement>(null);

  const toast = useToast();

  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const MAX_FILE_SIZE = ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

  const handleFileChange =
    (e: React.ChangeEvent<HTMLInputElement>) => {

      if (!e.target.files?.length) {
        return;
      }

      const selectedFile =
        e.target.files[0];

      if (
        selectedFile.size >
        MAX_FILE_SIZE
      ) {

        toast.error({ title: "File too large", message: `"${selectedFile.name}" is larger than ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB. The maximum allowed file size is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB per PDF.`, fileName: selectedFile.name, fileSize: selectedFile.size });

        e.target.value = "";
        setFile(null);

        return;
      }

      setFile(selectedFile);
    };


  const handleCompress =
    async () => {

      if (!file) {

        toast.warning({ title: "No PDF selected", message: "Please select a PDF to compress." });

        return;
      }

      setLoading(true);

      try {

        const workspaceFile: WorkspaceFile = {
          id: crypto.randomUUID(),
          file,
          filename: file.name,
          extension: ".pdf",
          size: file.size,
          pages: 0,
          status: "ready",
          encrypted: false,
          corrupted: false,
          password: "",
          showPassword: false,
          skipped: false
        };

        const context: ProcessingContext = {
          files: [workspaceFile],
          toolType: "compress"
        };

        const processor =
          new CompressPdfProcessor();

        const result =
          await processor.process(
            context
          );

        if (
          !result.success ||
          !result.outputFile
        ) {

          throw new Error(
            result.error ||
            "Compression failed."
          );

        }

        const outputFile =
          result.outputFile;

        const url =
          window.URL.createObjectURL(
            outputFile
          );

        const link =
          document.createElement("a");

        link.href = url;
        link.download =
          "compressed.pdf";

        document.body.appendChild(
          link
        );

        link.click();
        link.remove();

        window.URL.revokeObjectURL(
          url
        );
        toast.success({ title: "Compression completed", message: "Your PDF was compressed successfully." });

      } catch (error: unknown) {

        console.warn("Compress PDF failed:", error);

        const message =
          error instanceof Error &&
          error.message.length > 0
            ? error.message
            : "Unable to compress PDF.";
        toast.error({ title: "Compression failed", message });

      } finally {

        setLoading(false);

      }

    };


  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">

      <h1 className="text-4xl font-bold mb-4">
        Compress PDF
      </h1>

      <p className="mb-8 text-gray-600">
        Reduce PDF size while maintaining quality.
      </p>

      <button
        onClick={() =>
          inputRef.current?.click()
        }
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition"
      >
        Select PDF
      </button>

      <input
        type="file"
        accept=".pdf,application/pdf"
        ref={inputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {file && (
        <div className="mt-8 w-full max-w-lg bg-white rounded-xl shadow p-6">

          <h3 className="font-bold mb-3">
            Selected File
          </h3>

          <div className="border rounded p-2">
            {file.name}
          </div>

          <button
            onClick={handleCompress}
            disabled={loading}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-3 rounded-lg transition"
          >
            {loading
              ? "Compressing..."
              : "Compress PDF"}
          </button>

        </div>
      )}

    </main>
  );
}
