"use client";

import { Upload, Lock } from "lucide-react";
import { useRef } from "react";

export default function Hero() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-100">
      {/* Background Decoration */}
      <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 md:block">
        <div className="grid grid-cols-4 gap-3 opacity-20">
          {Array.from({ length: 16 }).map((_, index) => (
            <div
              key={index}
              className="h-2.5 w-2.5 rounded-full bg-gray-400"
            />
          ))}
        </div>
      </div>

      <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 md:block">
        <div className="grid grid-cols-4 gap-3 opacity-20">
          {Array.from({ length: 16 }).map((_, index) => (
            <div
              key={index}
              className="h-2.5 w-2.5 rounded-full bg-red-400"
            />
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center md:py-20">
        <h1 className="text-5xl font-extrabold leading-tight text-gray-900 md:text-6xl">
          Professional{" "}
          <span className="text-red-600">PDF</span> Tools Online
        </h1>

        <p className="mt-6 max-w-3xl text-xl text-gray-600">
          Merge, Split, Compress, Convert and Edit PDF files securely
          in your browser.
        </p>

        <p className="mt-2 text-lg text-gray-500">
          Fast, secure and completely free.
        </p>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
        />

        {/* Upload Button */}
        <button
          onClick={handleSelectFile}
          className="mt-10 flex items-center gap-3 rounded-2xl bg-red-600 px-10 py-5 text-xl font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-red-700 hover:shadow-xl"
        >
          <Upload size={24} />
          Select PDF File
        </button>

        <p className="mt-6 text-gray-600">
          Maximum file size:{" "}
          <span className="font-semibold">15 MB</span>
        </p>

        <div className="mt-3 flex items-center gap-2 text-gray-600">
          <Lock size={18} className="text-green-600" />
          <span>Files are encrypted &amp; automatically deleted.</span>
        </div>
      </div>
    </section>
  );
}