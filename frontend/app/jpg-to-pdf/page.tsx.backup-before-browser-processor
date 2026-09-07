
"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export default function JpgToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

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

        e.target.value = "";
        setFiles([]);

        return;
      }
    }

    setFiles(selectedFiles);
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      alert("Please select JPG images.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(
        `${API_URL}/jpg-to-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.detail || "Conversion failed."
        );
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = "converted.pdf";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      alert("PDF downloaded successfully!");
    } catch (error: any) {
      console.error(error);

      alert(
        error.message ||
          "Unable to connect to backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">

      <h1 className="text-4xl font-bold mb-4">
        JPG to PDF
      </h1>

      <p className="mb-8 text-gray-600">
        Convert JPG images into a single PDF.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg transition"
      >
        Select JPG Images
      </button>

      <input
        type="file"
        multiple
        accept=".jpg,.jpeg,.png"
        ref={inputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {files.length > 0 && (
        <div className="mt-8 w-full max-w-lg bg-white rounded-xl shadow p-6">

          <h3 className="font-bold mb-3">
            Selected Images
          </h3>

          {files.map((file, index) => (
            <div
              key={index}
              className="border rounded p-2 mb-2"
            >
              {file.name}
            </div>
          ))}

          <button
            onClick={handleConvert}
            disabled={loading}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-3 rounded-lg transition"
          >
            {loading
              ? "Converting..."
              : "Convert to PDF"}
          </button>

        </div>
      )}

    </main>
  );
}

