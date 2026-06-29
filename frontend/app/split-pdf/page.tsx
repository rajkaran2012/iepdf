
"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export default function SplitPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files?.length) return;

    const selectedFile = e.target.files[0];

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert(
        `"${selectedFile.name}" is larger than 15 MB.\n\nMaximum allowed file size is 15 MB.`
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setFile(selectedFile);
  };

  const handleSplitPDF = async () => {
    if (!file) {
      alert("Please select a PDF.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/split-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Split failed.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = "split_pages.zip";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      alert("ZIP downloaded successfully!");
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
        Split PDF
      </h1>

      <p className="mb-8 text-gray-600">
        Split PDF pages into separate PDF files.
      </p>

      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleSelectFile}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
      >
        Select PDF
      </button>

      {file && (
        <div className="mt-8 w-full max-w-lg bg-white rounded-xl shadow p-6">
          <h3 className="font-bold mb-3">
            Selected File
          </h3>

          <div className="border rounded p-2">
            {file.name}
          </div>

          <button
            onClick={handleSplitPDF}
            disabled={loading}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-3 rounded-lg transition"
          >
            {loading ? "Splitting..." : "Split PDF"}
          </button>
        </div>
      )}
    </main>
  );
}

