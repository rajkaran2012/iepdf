import { MonitorSmartphone, ShieldCheck, UserRound, Zap } from "lucide-react";

const features = [
  {
    title: "No registration",
    description: "Open a tool and get to work without creating an account.",
    icon: UserRound,
  },
  {
    title: "Works in your browser",
    description: "Files are processed directly in your browser wherever technically possible.",
    icon: ShieldCheck,
  },
  {
    title: "Simple workflow",
    description: "Choose a tool, add your files and download the result.",
    icon: Zap,
  },
  {
    title: "Works across devices",
    description: "Use iePDF on desktop, tablet or mobile.",
    icon: MonitorSmartphone,
  },
];

export default function Features() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-9">

        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-600">
            Built for you
          </p>

          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950">
            Why choose iePDF?
          </h2>

          <p className="mt-1.5 text-sm text-slate-600">
            Straightforward PDF tools without unnecessary complexity.
          </p>
        </div>

        <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {features.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="text-center lg:text-left"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 lg:mx-0">
                <Icon
                  className="h-5 w-5"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-950">
                {title}
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                {description}
              </p>
            </article>
          ))}

        </div>
      </div>
    </section>
  );
}