import type { Metadata } from "next";
import "./globals.css";

import Navbar from "@/components/layout/Navbar";
import ToastProvider from "@/components/notification/ToastProvider";

export const metadata: Metadata = {
  title: "iePDF - Free Online PDF Tools",
  description:
    "Merge, Split, Compress, Convert, PDF to JPG, JPG to PDF and more. Fast, secure and free online PDF tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className="antialiased bg-gray-50"
      >
        <ToastProvider>
          <Navbar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
