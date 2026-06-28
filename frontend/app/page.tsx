import Link from "next/link";

export default function Home() {
  const tools = [
    { name: "Merge PDF", link: "/merge-pdf" },
    { name: "Split PDF", link: "/split-pdf" },
    { name: "PDF to JPG", link: "/pdf-to-jpg" },
    { name: "JPG to PDF", link: "/jpg-to-pdf" },
    { name: "Compress PDF", link: "/compress-pdf" },
  ];

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="bg-red-600 text-white text-center py-16">
        <h1 className="text-5xl font-bold">iePDF</h1>
        <p className="mt-4 text-xl">
          Every PDF Tool You Need - 100% Free
        </p>
      </div>

      <div className="max-w-6xl mx-auto p-8 grid md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link key={tool.name} href={tool.link}>
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg cursor-pointer text-center">
              <h2 className="text-xl font-semibold">
                {tool.name}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}