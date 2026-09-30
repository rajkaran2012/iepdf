import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import ToastProvider from "@/components/notification/ToastProvider";

export const metadata: Metadata = {
  title: "iePDF â€” Simple Online PDF Tools",
  description: "Simple online PDF tools to merge, split, compress and convert PDF files.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}