import {
  ShieldCheck,
  Zap,
  Globe,
  HeartHandshake,
} from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "100% Secure",
    description:
      "Your files are encrypted during processing and automatically deleted after completion.",
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    icon: Zap,
    title: "Fast Processing",
    description:
      "Merge, split, compress and convert PDFs in just a few seconds.",
    color: "text-yellow-600",
    bg: "bg-yellow-100",
  },
  {
    icon: Globe,
    title: "Works Everywhere",
    description:
      "Use iePDF on Windows, Mac, Linux, Android and iPhone directly in your browser.",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    icon: HeartHandshake,
    title: "Completely Free",
    description:
      "No software installation, no registration and no hidden charges.",
    color: "text-red-600",
    bg: "bg-red-100",
  },
];

export default function Features() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900">
            Why Choose iePDF?
          </h2>

          <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-red-600" />

          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600">
            Everything you need to work with PDF files quickly,
            securely and completely free.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div
                  className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${feature.bg}`}
                >
                  <Icon
                    size={32}
                    className={feature.color}
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-900">
                  {feature.title}
                </h3>

                <p className="mt-4 leading-7 text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}