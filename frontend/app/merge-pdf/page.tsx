"use client";

import { useRef, useState } from "react";

import { API_URL } from "@/lib/api";
import { validateFiles } from "@/lib/validateFile";
import { createNotifications } from "@/lib/notifications";

import useToast from "@/hooks/useToast";

import LoadingOverlay from "@/components/loading/LoadingOverlay";
import ToolLayout from "@/components/layout/ToolLayout";

export default function MergePDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const toast = useToast();
  const notifications = createNotifications(toast);

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    const result = validateFiles(selectedFiles, "merge");

    if (!result.success) {
      notifications.fromValidation(result);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSuccess(false);
    setFiles(selectedFiles);
  };

  const handleMerge = async () => {
    const result = validateFiles(files, "merge");

    if (!result.success) {
      notifications.fromValidation(result);
      return;
    }

    setLoading(true);

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`${API_URL}/merge-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Merge failed.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      notifications.mergeSuccess("merged.pdf");
      setSuccess(true);
    } catch (error) {
      console.error(error);
      notifications.networkError();
    } finally {
      setLoading(false);
    }
  };

  const handleMergeAnother = () => {
    setFiles([]);
    setSuccess(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <LoadingOverlay
        open={loading}
        title="Merging PDF Files"
        message="Please wait while we merge your documents..."
      />

      <ToolLayout
        title="Merge PDF"
        description="Combine multiple PDF files into a single document quickly and securely."
      >
        <div className="flex flex-col items-center">
          <input
            type="file"
            accept=".pdf"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {!success && (
            <>
              <button
                onClick={handleSelectFiles}
                className="rounded-xl bg-red-600 px-8 py-4 font-semibold text-white transition hover:bg-red-700"
              >
                Select PDF Files
              </button>

              {files.length > 0 && (
                <div className="mt-8 w-full max-w-2xl">
                  <div className="rounded-xl border bg-gray-50 p-6">
                    <h3 className="mb-4 text-xl font-bold">
                      Selected Files
                    </h3>

                    <ul className="space-y-3">
                      {files.map((file, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
                        >
                          <span>{file.name}</span>

                          <span className="text-sm text-gray-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={handleMerge}
                      disabled={loading}
                      className="mt-8 w-full rounded-xl bg-green-600 py-4 font-semibold text-white transition hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {loading ? "Merging PDFs..." : "Merge PDFs"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {success && (
            <div className="mt-8 w-full max-w-2xl">
              <div className="rounded-2xl border border-green-300 bg-green-50 p-10 text-center shadow">
                <div className="mb-4 text-6xl">✅</div>

                <h2 className="text-3xl font-bold text-green-700">
                  PDF Merged Successfully!
                </h2>

                <p className="mt-4 text-gray-700">
                  Your merged PDF has been downloaded successfully.
                </p>

                <button
                  onClick={handleMergeAnother}
                  className="mt-8 rounded-xl bg-red-600 px-8 py-4 font-semibold text-white transition hover:bg-red-700"
                >
                  Merge Another PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </ToolLayout>
    </>
  );
}