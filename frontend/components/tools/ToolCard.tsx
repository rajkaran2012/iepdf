import Link from "next/link";
import { ArrowRight } from "lucide-react";

import ToolIcon from "@/components/tools/ToolIcon";
import type { ToolDefinition } from "@/config/toolRegistry";

type ToolCardProps = {
  tool: ToolDefinition;
};

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      href={tool.href}
      className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-4"
      aria-label={`Open ${tool.title}`}
    >
      <div className="flex h-full min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#C9CAFA] hover:shadow-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F1FF] text-[#5B5CE2]">
          <ToolIcon tool={tool} />
        </div>

        <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-950">
          {tool.title}
        </h3>

        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
          {tool.description}
        </p>

        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5B5CE2]">
          Open tool
          <ArrowRight
            size={17}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}