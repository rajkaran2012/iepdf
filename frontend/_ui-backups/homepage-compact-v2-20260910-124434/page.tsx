import Link from "next/link";
import { ArrowRight, Download, FilePlus2, Upload } from "lucide-react";
import Hero from "@/components/layout/Hero";
import Features from "@/components/layout/Features";
import ToolCard from "@/components/tools/ToolCard";
import { TOOL_REGISTRY } from "@/config/toolRegistry";

const workflow = [
  { number: "1", title: "Choose a tool", description: "Select the PDF task you need.", icon: Upload },
  { number: "2", title: "Add your files", description: "Upload the PDF or images required by the tool.", icon: FilePlus2 },
  { number: "3", title: "Download", description: "Process your files and download the result.", icon: Download },
];

export default function Home() {
  return (
    <main className="bg-white text-slate-950">
      <Hero />

      <section id="tools" className="scroll-mt-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-600">PDF tools</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Choose a PDF tool</h2>
            <p className="mt-3 text-base text-slate-600">Start in one click. No account or unnecessary steps.</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TOOL_REGISTRY.map((tool) => (
              <ToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-600">Simple workflow</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Three simple steps</h2>
          </div>

          <div className="relative mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-3 lg:gap-16">
            {workflow.map(({ number, title, description, icon: Icon }, index) => (
              <div key={number} className="relative text-center">
                <div className="mx-auto flex items-center justify-center gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600">{number}</span>
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-slate-200">
                    <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{description}</p>
                {index < workflow.length - 1 && <ArrowRight className="absolute -right-10 top-5 hidden h-6 w-6 text-slate-300 lg:block" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Features />

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto_auto] md:items-start">
            <div>
              <Link href="/" className="text-2xl font-black tracking-[-0.06em] text-white">ie<span className="text-red-500">PDF</span></Link>
              <p className="mt-2 text-sm text-slate-400">Simple PDF tools for everyday work.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tools</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {TOOL_REGISTRY.map((tool) => <Link key={tool.href} href={tool.href} className="hover:text-white">{tool.title}</Link>)}
              </div>
            </div>
            <div className="text-sm md:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">iePDF</p>
              <p className="mt-3 text-slate-400">Â© 2026 iePDF. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}