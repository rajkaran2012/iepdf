
"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export default function MergePDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        alert(
          `"${file.name}" is larger than 15 MB.\n\nMaximum allowed file size is 15 MB.`
        );

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        return;
      }
    }

    setFiles(selectedFiles);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      alert("Please select at least 2 PDF files.");
      return;
    }

    setLoading(true);

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(
        `${API_URL}/merge-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

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
    } catch (error: any) {
      console.error(error);

      alert(
        error.message ||
          "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold mb-4">
        Merge PDF
      </h1>

      <p className="mb-8 text-gray-600">
        Combine multiple PDF files into one.
      </p>

      <input
        type="file"
        accept=".pdf"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleSelectFiles}
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition"
      >
        Select PDF Files
      </button>

      {files.length > 0 && (
        <div className="mt-8 w-full max-w-lg bg-white rounded-xl shadow p-6">
          <h3 className="font-bold mb-3">
            Selected Files
          </h3>

          <ul className="space-y-2">
            {files.map((file, index) => (
              <li
                key={index}
                className="border rounded p-2"
              >
                {file.name}
              </li>
            ))}
          </ul>

          <button
            onClick={handleMerge}
            disabled={loading}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-3 rounded-lg transition"
          >
            {loading ? "Merging..." : "Merge PDFs"}
          </button>
        </div>
      )}
    </main>
  );
}

