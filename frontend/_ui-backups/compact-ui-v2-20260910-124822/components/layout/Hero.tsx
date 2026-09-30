"use client";

import { Check, FileText } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-rose-50/40 to-slate-50/70">
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-slate-100/80 blur-3xl" />
      <div className="pointer-events-none absolute right-[-90px] top-8 h-80 w-80 rounded-full bg-rose-100/80 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_360px] lg:px-10 lg:py-20">
        <div className="text-center lg:text-left">
          <div className="mx-auto inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-red-600 lg:mx-0">
            5 essential PDF tools
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:mx-0 lg:text-6xl">
            Powerful PDF tools.
            <span className="block text-red-600">Simple &amp; private.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg lg:mx-0">
            Merge, split, compress and convert your files in a few clicks.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm font-medium text-slate-700 lg:justify-start">
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />Free to use</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />No registration</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />Up to 15 MB</span>
          </div>
        </div>

        <div className="hidden justify-center lg:flex" aria-hidden="true">
          <div className="relative flex h-64 w-64 items-center justify-center rounded-full bg-red-100/70">
            <div className="relative h-44 w-36 rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
              <div className="absolute right-0 top-0 h-10 w-10 rounded-bl-xl bg-slate-100" />
              <div className="absolute left-6 right-6 top-14 space-y-3">
                <div className="h-2 rounded bg-slate-100" />
                <div className="h-2 w-4/5 rounded bg-slate-100" />
                <div className="h-2 rounded bg-slate-100" />
              </div>
              <div className="absolute -left-5 bottom-7 rounded-lg bg-red-600 px-5 py-2 text-xl font-extrabold text-white shadow-lg">PDF</div>
            </div>
            <FileText className="absolute -right-2 bottom-3 h-10 w-10 text-red-500" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </section>
  );
}