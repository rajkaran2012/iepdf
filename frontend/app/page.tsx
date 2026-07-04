import Hero from "@/components/layout/Hero";
import Features from "@/components/layout/Features";
import Stats from "@/components/layout/Stats";
import ToolCard from "@/components/tools/ToolCard";

import {
  Merge,
  Scissors,
  ImageIcon,
  FileImage,
  Archive,
} from "lucide-react";

export default function Home() {
  const tools = [
    {
      title: "Merge PDF",
      href: "/merge-pdf",
      description: "Combine multiple PDFs into one document.",
      icon: <Merge size={30} className="text-red-600" />,
      color: "bg-red-100",
    },
    {
      title: "Split PDF",
      href: "/split-pdf",
      description: "Split PDF pages into separate files.",
      icon: <Scissors size={30} className="text-blue-600" />,
      color: "bg-blue-100",
    },
    {
      title: "Compress PDF",
      href: "/compress-pdf",
      description: "Reduce PDF size while maintaining quality.",
      icon: <Archive size={30} className="text-green-600" />,
      color: "bg-green-100",
    },
    {
      title: "PDF to JPG",
      href: "/pdf-to-jpg",
      description: "Convert PDF pages into JPG images.",
      icon: <ImageIcon size={30} className="text-orange-600" />,
      color: "bg-orange-100",
    },
    {
      title: "JPG to PDF",
      href: "/jpg-to-pdf",
      description: "Convert JPG images into a PDF.",
      icon: <FileImage size={30} className="text-violet-600" />,
      color: "bg-violet-100",
    },
  ];

  return (
    <main className="bg-[#F8FAFC]">
      <Hero />

      <section
        id="tools"
        className="mx-auto max-w-7xl px-6 py-16"
      >
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900">
            Popular PDF Tools
          </h2>

          <p className="mt-4 text-gray-600">
            Everything you need to work with PDF documents.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard
              key={tool.title}
              title={tool.title}
              description={tool.description}
              href={tool.href}
              icon={tool.icon}
              color={tool.color}
            />
          ))}
        </div>
      </section>

      <Features />
      <Stats />
    </main>
  );
}