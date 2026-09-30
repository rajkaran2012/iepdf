import Link from "next/link";

import Features from "@/components/layout/Features";
import Hero from "@/components/layout/Hero";
import ToolCard from "@/components/tools/ToolCard";
import { TOOL_REGISTRY } from "@/config/toolRegistry";
import BrandLogo from "@/components/layout/BrandLogo";

export default function Home() {
  return (
    <main className="bg-slate-50">
      <Hero />

      <section
        id="tools"
        aria-labelledby="tools-heading"
        className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14 sm:px-6 sm:py-16 lg:py-20"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5B5CE2]">
            PDF tools
          </p>

          <h2
            id="tools-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Choose a PDF tool
          </h2>

          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Start in one click. No account or unnecessary steps.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_REGISTRY.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="how-heading"
        className="border-y border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5B5CE2]">
              Simple workflow
            </p>

            <h2
              id="how-heading"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
            >
              Three simple steps
            </h2>
          </div>

          <ol className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Choose a tool",
                description: "Select the PDF task you need.",
              },
              {
                number: "02",
                title: "Add your files",
                description: "Upload the PDF or images required by the tool.",
              },
              {
                number: "03",
                title: "Download",
                description: "Process your files and download the result.",
              },
            ].map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <span className="text-sm font-bold text-[#5B5CE2]">
                  {step.number}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-2 leading-6 text-slate-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Features />

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandLogo variant="footer" />
            <p className="mt-2 text-sm text-slate-400">
              Simple PDF tools for everyday work.
            </p>
          </div>

          <nav aria-label="Footer tools" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {TOOL_REGISTRY.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {tool.shortTitle}
              </Link>
            ))}
          </nav>

        <p className="text-sm text-slate-500">&#169; 2026 iePDF</p>
        </div>
      </footer>
    </main>
  );
}


