"use client";

import { Check, FileText } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-rose-50/40 to-slate-50/70">
      <div className="pointer-events-none absolute -left-24 top-4 h-48 w-48 rounded-full bg-slate-100/70 blur-3xl" />
      <div className="pointer-events-none absolute right-[-60px] top-2 h-52 w-52 rounded-full bg-rose-100/70 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_230px] lg:px-8 lg:py-9">

        <div className="text-center lg:text-left">

          <div className="mx-auto inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-red-600 lg:mx-0">
            5 essential PDF tools
          </div>

          <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl lg:mx-0 lg:text-4xl">
            Powerful PDF tools.
            <span className="block text-red-600">
              Simple &amp; private.
            </span>
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base lg:mx-0">
            Merge, split, compress and convert your files in a few clicks.
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-700 lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Free to use
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              No registration
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Up to 15 MB
            </span>
          </div>

        </div>

        <div className="hidden justify-center lg:flex" aria-hidden="true">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-red-100/70">

            <div className="relative h-28 w-23 rounded-lg bg-white shadow-lg ring-1 ring-slate-200">

              <div className="absolute right-0 top-0 h-7 w-7 rounded-bl-lg bg-slate-100" />

              <div className="absolute left-4 right-4 top-9 space-y-2">
                <div className="h-1.5 rounded bg-slate-100" />
                <div className="h-1.5 w-4/5 rounded bg-slate-100" />
                <div className="h-1.5 rounded bg-slate-100" />
              </div>

              <div className="absolute -left-4 bottom-4 rounded-md bg-red-600 px-3 py-1 text-sm font-extrabold text-white shadow-md">
                PDF
              </div>

            </div>

            <FileText
              className="absolute -right-1 bottom-2 h-7 w-7 text-red-500"
              strokeWidth={1.5}
            />

          </div>
        </div>

      </div>
    </section>
  );
}