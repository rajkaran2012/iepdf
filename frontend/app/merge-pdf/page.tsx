"use client";

import { useRef, useState } from "react";

export default function MergePDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
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
        "http://127.0.0.1:8000/merge-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      const blob = await response.blob();

const url = window.URL.createObjectURL(blob);

const a = document.createElement("a");

a.href = url;
a.download = "merged.pdf";

document.body.appendChild(a);

a.click();

a.remove();

window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Error connecting to backend.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">
        Merge PDF
      </h1>

      <p className="mb-8">
        Combine PDFs into one file.
      </p>

      <input
        type="file"
        multiple
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={handleSelectFiles}
        className="bg-red-600 text-white px-6 py-3 rounded-lg"
      >
        Select PDF Files
      </button>

      {files.length > 0 && (
        <div className="mt-6 text-center">
          <h3 className="font-bold mb-2">
            Selected Files:
          </h3>

          {files.map((file, index) => (
            <div key={index}>
              {file.name}
            </div>
          ))}

          <button
            onClick={handleMerge}
            className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            {loading ? "Merging..." : "Merge PDFs"}
          </button>
        </div>
      )}
    </main>
  );
}