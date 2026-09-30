"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { TOOL_REGISTRY } from "@/config/toolRegistry";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" className="text-2xl font-black tracking-[-0.06em] text-slate-950" aria-label="iePDF home">
          ie<span className="text-red-600">PDF</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="PDF tools">
          {TOOL_REGISTRY.map((tool) => (
            <Link key={tool.href} href={tool.href} className="text-sm font-medium text-slate-700 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4">
              {tool.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <span className="text-sm font-medium text-slate-600">Browser-first</span>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-tools-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-tools-menu" className="border-t border-slate-200 bg-white px-5 py-3 lg:hidden" aria-label="Mobile PDF tools">
          {TOOL_REGISTRY.map((tool) => (
            <Link key={tool.href} href={tool.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
              {tool.title}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}