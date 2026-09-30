import { MonitorSmartphone, ShieldCheck, UserRound, Zap } from "lucide-react";

const features = [
  { title: "No registration", description: "Open a tool and get to work without creating an account.", icon: UserRound },
  { title: "Works in your browser", description: "Files are processed directly in your browser wherever technically possible.", icon: ShieldCheck },
  { title: "Simple workflow", description: "Choose a tool, add your files and download the result.", icon: Zap },
  { title: "Works across devices", description: "Use iePDF on desktop, tablet or mobile.", icon: MonitorSmartphone },
];

export default function Features() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-600">Built for you</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Why choose iePDF?</h2>
          <p className="mt-3 text-base text-slate-600">Straightforward PDF tools without unnecessary complexity.</p>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ title, description, icon: Icon }) => (
            <article key={title} className="text-center lg:text-left">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 lg:mx-0">
                <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}