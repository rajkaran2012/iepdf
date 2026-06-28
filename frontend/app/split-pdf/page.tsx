"use client";

import { useRef, useState } from "react";

export default function SplitPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
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
        "http://127.0.0.1:8000/split-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Split failed");
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
    } catch (error) {
      console.error(error);
      alert("Error splitting PDF.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">
        Split PDF
      </h1>

      <p className="mb-8">
        Split PDF pages into separate PDF files.
      </p>

      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
          }
        }}
      />

      <button
        onClick={handleSelectFile}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Select PDF
      </button>

      {file && (
        <div className="mt-6 text-center">
          <p className="mb-4">{file.name}</p>

          <button
            onClick={handleSplitPDF}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            {loading ? "Splitting..." : "Split PDF"}
          </button>
        </div>
      )}
    </main>
  );
}