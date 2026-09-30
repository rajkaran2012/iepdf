import Link from "next/link";
import { ArrowRight, Download, FilePlus2, Upload } from "lucide-react";
import Hero from "@/components/layout/Hero";
import Features from "@/components/layout/Features";
import ToolCard from "@/components/tools/ToolCard";
import { TOOL_REGISTRY } from "@/config/toolRegistry";

const workflow = [
  {
    number: "1",
    title: "Choose a tool",
    description: "Select the PDF task you need.",
    icon: Upload,
  },
  {
    number: "2",
    title: "Add your files",
    description: "Upload the PDF or images required.",
    icon: FilePlus2,
  },
  {
    number: "3",
    title: "Download",
    description: "Process your files and download the result.",
    icon: Download,
  },
];

export default function Home() {
  return (
    <main className="bg-white text-slate-950">

      {/* HERO */}
      <Hero />

      {/* TOOLS */}
      <section
        id="tools"
        className="scroll-mt-20 border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">

          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-600">
              PDF tools
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Choose a PDF tool
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Start in one click. No account or unnecessary steps.
            </p>
          </div>

          <div className="mx-auto mt-7 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TOOL_REGISTRY.map((tool) => (
              <ToolCard key={tool.href} tool={tool} />
            ))}
          </div>

        </div>
      </section>

      {/* WORKFLOW */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-10">

          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-600">
              Simple workflow
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Three simple steps
            </h2>
          </div>

          <div className="relative mx-auto mt-8 grid max-w-5xl gap-7 lg:grid-cols-3 lg:gap-12">

            {workflow.map(
              ({ number, title, description, icon: Icon }, index) => (
                <div key={number} className="relative text-center">

                  <div className="flex items-center justify-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">
                      {number}
                    </span>

                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-slate-200">
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-slate-950">
                    {title}
                  </h3>

                  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-600">
                    {description}
                  </p>

                  {index < workflow.length - 1 && (
                    <ArrowRight
                      className="absolute -right-8 top-4 hidden h-5 w-5 text-slate-300 lg:block"
                      aria-hidden="true"
                    />
                  )}

                </div>
              ),
            )}

          </div>
        </div>
      </section>

      {/* FEATURES */}
      <Features />

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">

          <div className="grid gap-5 md:grid-cols-[1fr_auto_auto] md:items-center">

            <div>
              <Link
                href="/"
                className="text-xl font-black tracking-[-0.06em] text-white"
              >
                ie<span className="text-red-500">PDF</span>
              </Link>

              <p className="mt-1 text-xs text-slate-400">
                Simple PDF tools for everyday work.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Tools
              </p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {TOOL_REGISTRY.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="transition-colors hover:text-white"
                  >
                    {tool.title}
                  </Link>
                ))}
              </div>
            </div>

            <div className="text-xs md:text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                iePDF
              </p>

              <p className="mt-2 text-slate-400">
                © 2026 iePDF. All rights reserved.
              </p>
            </div>

          </div>
        </div>
      </footer>

    </main>
  );
}