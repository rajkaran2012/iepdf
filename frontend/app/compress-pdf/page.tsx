"use client";

import { useRef, useState } from "react";

export default function CompressPDF() {

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const handleCompress = async () => {

    if (!file) {
      alert("Please select a PDF.");
      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    setLoading(true);

    try {

      const res = await fetch(
        "http://127.0.0.1:8000/compress-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Compression failed");
      }

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;

      a.download = "compressed.pdf";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      alert("Compressed PDF downloaded successfully!");

    } catch (error) {

      console.error(error);

      alert("Error compressing PDF.");

    }

    setLoading(false);

  };

  return (

    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">

      <h1 className="text-4xl font-bold mb-4">
        Compress PDF
      </h1>

      <p className="mb-8">
        Reduce PDF file size while maintaining quality.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="bg-red-600 text-white px-6 py-3 rounded-lg"
      >
        Select PDF
      </button>

      <input
        type="file"
        accept=".pdf"
        ref={inputRef}
        className="hidden"
        onChange={(e) => {

          const selectedFile = e.target.files?.[0];

          if (!selectedFile) return;

          const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

          if (selectedFile.size > MAX_SIZE) {

            alert(
              "❌ Maximum file size is 15 MB.\n\nPlease select a smaller PDF."
            );

            e.target.value = "";

            setFile(null);

            return;

          }

          setFile(selectedFile);

        }}
      />

      {file && (

        <>

          <p className="mt-5 font-medium">
            {file.name}
          </p>

          <button
            onClick={handleCompress}
            disabled={loading}
            className="mt-5 bg-green-600 text-white px-6 py-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Compressing..." : "Compress PDF"}
          </button>

        </>

      )}

    </main>

  );

}