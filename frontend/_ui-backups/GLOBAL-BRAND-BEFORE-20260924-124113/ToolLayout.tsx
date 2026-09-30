"use client";

import { ReactNode } from "react";

interface ToolLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}

export default function ToolLayout({
  title,
  description,
  children,
  wide = false,
}: ToolLayoutProps) {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className={wide ? "mx-auto w-full px-4 py-3" : "mx-auto max-w-5xl px-4 py-12"}>
        <div className={wide ? "mb-3 text-center" : "mb-10 text-center"}>
          <h1 className="text-4xl font-bold text-gray-900">
            {title}
          </h1>

          <p className="mt-4 text-lg text-gray-600">
            {description}
          </p>
        </div>

        <div className={wide ? "w-full" : "rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"}>
          {children}
        </div>
      </div>
    </main>
  );
}