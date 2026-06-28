"use client";

import { useRef, useState } from "react";

export default function JpgToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      alert("Please select JPG images.");
      return;
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    setLoading(true);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/jpg-to-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Conversion failed");
      }

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = "converted.pdf";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      alert("PDF downloaded successfully!");

    } catch (error) {
      console.error(error);
      alert("Error converting JPG to PDF.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">

      <h1 className="text-4xl font-bold mb-4">
        JPG to PDF
      </h1>

      <p className="mb-8">
        Convert JPG images into a single PDF.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="bg-orange-600 text-white px-6 py-3 rounded-lg"
      >
        Select JPG Images
      </button>

      <input
        type="file"
        multiple
        accept=".jpg,.jpeg,.png"
        ref={inputRef}
        className="hidden"
        onChange={(e) => {

          if (!e.target.files) return;

          const selectedFiles = Array.from(e.target.files);

          const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

          for (const file of selectedFiles) {

            if (file.size > MAX_SIZE) {

              alert(
                `❌ ${file.name}\n\nMaximum allowed file size is 15 MB.`
              );

              e.target.value = "";

              setFiles([]);

              return;
            }
          }

          setFiles(selectedFiles);

        }}
      />

      {files.length > 0 && (
        <div className="mt-6 text-center">

          <h3 className="font-bold mb-3">
            Selected Images
          </h3>

          {files.map((file, index) => (
            <p key={index}>
              {file.name}
            </p>
          ))}

          <button
            onClick={handleConvert}
            disabled={loading}
            className="mt-5 bg-green-600 text-white px-6 py-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Converting..." : "Convert to PDF"}
          </button>

        </div>
      )}

    </main>
  );