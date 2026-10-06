export type ToolDefinition = {
  title: string;
  shortTitle: string;
  href: string;
  description: string;
  icon: "merge" | "split" | "compress" | "pdf-to-jpg" | "jpg-to-pdf";
  featured?: boolean;
};

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  {
    title: "Merge PDF",
    shortTitle: "Merge PDF",
    href: "/merge-pdf",
    description: "Combine multiple PDF files into one document.",
    icon: "merge",
    featured: true,
  },
  {
    title: "Split PDF",
    shortTitle: "Split PDF",
    href: "/split-pdf",
    description: "Extract pages from a PDF into separate files.",
    icon: "split",
    featured: true,
  },
  {
    title: "Compress PDF",
    shortTitle: "Compress PDF",
    href: "/compress-pdf",
    description: "Reduce PDF file size for easier sharing and storage.",
    icon: "compress",
    featured: true,
  },
  {
    title: "PDF to JPG",
    shortTitle: "PDF → JPG",
    href: "/pdf-to-jpg",
    description: "Convert PDF pages into JPG images.",
    icon: "pdf-to-jpg",
    featured: true,
  },
  {
    title: "JPG to PDF",
    shortTitle: "JPG → PDF",
    href: "/jpg-to-pdf",
    description: "Create a PDF from JPG or PNG images.",
    icon: "jpg-to-pdf",
    featured: true,
  },
];

export const MVP_TOOL_COUNT = TOOL_REGISTRY.length;
