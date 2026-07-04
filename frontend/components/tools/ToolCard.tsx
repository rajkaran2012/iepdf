import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReactNode } from "react";

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  color: string;
}

export default function ToolCard({
  title,
  description,
  href,
  icon,
  color,
}: ToolCardProps) {
  return (
    <Link href={href}>

      <div className="group h-full rounded-3xl border border-gray-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl ${color}`}
        >
          {icon}
        </div>

        <h3 className="mt-6 text-2xl font-bold text-gray-900">
          {title}
        </h3>

        <p className="mt-3 text-gray-600 leading-7">
          {description}
        </p>

        <div className="mt-8 flex items-center gap-2 font-semibold text-red-600">

          Open Tool

          <ArrowRight
            size={18}
            className="transition-transform group-hover:translate-x-1"
          />

        </div>

      </div>

    </Link>
  );
}