import {
  Archive,
  FileImage,
  Files,
  Image,
  Scissors,
} from "lucide-react";

import type { ToolDefinition } from "@/config/toolRegistry";

type ToolIconProps = {
  tool: ToolDefinition;
  size?: number;
  className?: string;
};

const iconMap = {
  merge: Files,
  split: Scissors,
  compress: Archive,
  "pdf-to-jpg": Image,
  "jpg-to-pdf": FileImage,
} as const;

export default function ToolIcon({
  tool,
  size = 28,
  className,
}: ToolIconProps) {
  const Icon = iconMap[tool.icon];

  return <Icon aria-hidden="true" size={size} className={className} />;
}