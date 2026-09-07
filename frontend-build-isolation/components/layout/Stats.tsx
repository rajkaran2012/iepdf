import {
  FileText,
  Users,
  ShieldCheck,
  Zap,
} from "lucide-react";

const stats = [
  {
    icon: FileText,
    value: "1M+",
    label: "PDF Files Processed",
    color: "text-red-600",
    bg: "bg-red-100",
  },
  {
    icon: Users,
    value: "50K+",
    label: "Happy Users",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    icon: ShieldCheck,
    value: "100%",
    label: "Secure Processing",
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    icon: Zap,
    value: "< 10s",
    label: "Average Processing",
    color: "text-yellow-600",
    bg: "bg-yellow-100",
  },
];

export default function Stats() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl bg-white p-8 text-center shadow-sm transition hover:shadow-lg"
              >
                <div
                  className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${item.bg}`}
                >
                  <Icon
                    size={30}
                    className={item.color}
                  />
                </div>

                <h3 className="text-4xl font-bold text-gray-900">
                  {item.value}
                </h3>

                <p className="mt-3 text-gray-600">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}