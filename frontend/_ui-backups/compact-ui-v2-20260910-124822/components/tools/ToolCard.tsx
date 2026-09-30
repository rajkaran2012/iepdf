import Link from "next/link";
import ToolIcon from "./ToolIcon";

import type { ToolDefinition } from "@/config/toolRegistry";

type ToolCardProps = {
  tool: ToolDefinition;
};

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      href={tool.href}
      className="group flex min-h-[218px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-red-100 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4"
    >
      <ToolIcon tool={tool} />

      <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-950">
        {tool.title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
        {tool.description}
      </p>

      <span className="mt-auto pt-5 text-sm font-semibold text-red-600">
        Open tool{" "}
        <span className="inline-block transition-transform group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}