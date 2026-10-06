import {
  CheckCircle2,
  Globe2,
  ShieldCheck,
  UserRoundX,
} from "lucide-react";

const features = [
  {
    icon: UserRoundX,
    title: "No registration",
    description: "Open a tool and get to work without creating an account.",
  },
  {
    icon: ShieldCheck,
    title: "Browser-first design",
    description:
      "iePDF is designed around browser-first processing, using a backend only when it provides a clear technical advantage.",
  },
  {
    icon: CheckCircle2,
    title: "Simple workflow",
    description: "Choose a tool, add your files and download the result.",
  },
  {
    icon: Globe2,
    title: "Works across devices",
    description:
      "Use iePDF from a modern browser on desktop, tablet or mobile.",
  },
];

export default function Features() {
  return (
    <section
      aria-labelledby="why-heading"
      className="bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5B5CE2]">
            Built for simplicity
          </p>

          <h2
            id="why-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Why choose iePDF?
          </h2>

          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Straightforward PDF tools without unnecessary complexity.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F1FF] text-[#5B5CE2]">
                  <Icon size={24} aria-hidden="true" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  {feature.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
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