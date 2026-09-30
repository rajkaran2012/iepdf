"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { TOOL_REGISTRY } from "@/config/toolRegistry";
import BrandLogo from "@/components/layout/BrandLogo";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-6">
        <div onClick={() => setOpen(false)}>
          <BrandLogo variant="navbar" />
        </div>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-5 lg:flex"
        >
          {TOOL_REGISTRY.map((tool) => (
            <a
              key={tool.href}
              href={tool.href}
              className="whitespace-nowrap rounded-md px-1 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#5B5CE2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
            >
              {tool.shortTitle}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] lg:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-5 py-3 lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {TOOL_REGISTRY.map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#5B5CE2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2]"
              >
                {tool.title}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
