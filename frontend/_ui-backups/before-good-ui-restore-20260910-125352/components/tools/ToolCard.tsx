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
      className="group flex min-h-[165px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <ToolIcon tool={tool} size={22} />
      </div>

      <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950">
        {tool.title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-slate-600">
        {tool.description}
      </p>

      <span className="mt-auto pt-3 text-xs font-semibold text-red-600">
        Open tool{" "}
        <span className="inline-block transition-transform group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}