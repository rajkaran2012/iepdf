import Link from "next/link";
import { ArrowDown, Check } from "lucide-react";

import { TOOL_REGISTRY } from "@/config/toolRegistry";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-white to-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.10),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-14 text-center sm:px-6 sm:pb-14 sm:pt-16 lg:pb-16 lg:pt-20">
        <div className="mx-auto inline-flex items-center rounded-full border border-[#DCDDFB] bg-[#F1F1FF] px-4 py-2 text-sm font-semibold text-[#5B5CE2]">
          5 essential PDF tools
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
          Powerful PDF tools.
          <span className="block text-[#5B5CE2]">Simple &amp; private.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Merge, split, compress and convert PDF files quickly and easily.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
          <span className="inline-flex items-center gap-2">
            <Check size={16} className="text-green-600" />
            Free to use
          </span>
          <span className="inline-flex items-center gap-2">
            <Check size={16} className="text-green-600" />
            No registration
          </span>
          <span className="inline-flex items-center gap-2">
            <Check size={16} className="text-green-600" />
            Up to 15 MB
          </span>
        </div>

        <div className="mx-auto mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
          {TOOL_REGISTRY.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9CAFA] hover:text-[#5B5CE2] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
            >
              {tool.shortTitle}
            </Link>
          ))}
        </div>

        <Link
          href="#tools"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#5B5CE2] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#4D4FC7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
        >
          Choose a tool
          <ArrowDown size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}