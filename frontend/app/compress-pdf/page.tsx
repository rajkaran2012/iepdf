
"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export default function CompressPDF() {

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; //15 MB

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    if (!e.target.files?.length) return;

    const selectedFile = e.target.files[0];

    if (selectedFile.size > MAX_FILE_SIZE) {

      alert(
        `"${selectedFile.name}" is larger than 15 MB.\n\nMaximum allowed file size is 15 MB.`
      );

      e.target.value = "";

      setFile(null);

      return;

    }

    setFile(selectedFile);

  };

  const handleCompress = async () => {

    if (!file) {
      alert("Please select a PDF.");
      return;
    }

    setLoading(true);

    try {

      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/compress-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {

        const error = await response.json();

        throw new Error(
          error.detail || "Compression failed."
        );

      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;

      a.download = "compressed.pdf";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      alert("Compressed PDF downloaded successfully!");

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
        Compress PDF
      </h1>

      <p className="mb-8 text-gray-600">
        Reduce PDF size while maintaining quality.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition"
      >
        Select PDF
      </button>

      <input
        type="file"
        accept=".pdf"
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

