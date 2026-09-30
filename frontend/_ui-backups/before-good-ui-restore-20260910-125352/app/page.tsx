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

      <Hero />

      {/* TOOLS */}
      <section
        id="tools"
        className="scroll-mt-20 border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-8">

          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-600">
              PDF tools
            </p>

            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950">
              Choose a PDF tool
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Start in one click. No account or unnecessary steps.
            </p>
          </div>

          <div className="mx-auto mt-5 grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TOOL_REGISTRY.map((tool) => (
              <ToolCard key={tool.href} tool={tool} />
            ))}
          </div>

        </div>
      </section>

      {/* WORKFLOW */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-8">

          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-600">
              Simple workflow
            </p>

            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950">
              Three simple steps
            </h2>
          </div>

          <div className="relative mx-auto mt-6 grid max-w-4xl gap-6 lg:grid-cols-3 lg:gap-10">

            {workflow.map(
              ({ number, title, description, icon: Icon }, index) => (
                <div key={number} className="relative text-center">

                  <div className="flex items-center justify-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-600">
                      {number}
                    </span>

                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-slate-200">
                      <Icon
                        className="h-4.5 w-4.5"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-slate-950">
                    {title}
                  </h3>

                  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-600">
                    {description}
                  </p>

                  {index < workflow.length - 1 && (
                    <ArrowRight
                      className="absolute -right-7 top-3 hidden h-4 w-4 text-slate-300 lg:block"
                      aria-hidden="true"
                    />
                  )}

                </div>
              ),
            )}

          </div>
        </div>
      </section>

      <Features />

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-center">

            <div>
              <Link
                href="/"
                className="text-lg font-black tracking-[-0.06em] text-white"
              >
                ie<span className="text-red-500">PDF</span>
              </Link>

              <p className="mt-0.5 text-[11px] text-slate-400">
                Simple PDF tools for everyday work.
              </p>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Tools
              </p>

              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
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

            <div className="text-[11px] md:text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                iePDF
              </p>

              <p className="mt-1 text-slate-400">
                © 2026 iePDF. All rights reserved.
              </p>
            </div>

          </div>
        </div>
      </footer>

    </main>
  );
}