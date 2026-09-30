import type { Metadata } from "next";
import "./globals.css";

import Navbar from "@/components/layout/Navbar";
import ToastProvider from "@/components/notification/ToastProvider";

export const metadata: Metadata = {
  title: "iePDF — Simple Online PDF Tools",
  description:
    "Merge, split, compress and convert PDF files with simple, browser-first online PDF tools. Free to use with no registration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased bg-gray-50">
        <ToastProvider>
          <Navbar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
