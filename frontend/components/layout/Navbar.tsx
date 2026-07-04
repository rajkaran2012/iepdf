"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-2xl font-bold text-red-600"
        >
          iePDF
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/merge-pdf"
            className="text-gray-700 hover:text-red-600"
          >
            Merge PDF
          </Link>

          <Link
            href="/split-pdf"
            className="text-gray-700 hover:text-red-600"
          >
            Split PDF
          </Link>

          <Link
            href="/compress-pdf"
            className="text-gray-700 hover:text-red-600"
          >
            Compress PDF
          </Link>
        </nav>
      </div>
    </header>
  );
}