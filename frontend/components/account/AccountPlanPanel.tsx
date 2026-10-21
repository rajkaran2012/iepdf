"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { clearAccessToken, getAccountPlan, type AccountPlan } from "@/lib/auth";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${bytes / (1024 ** 3)} GB`;
  if (bytes >= 1024 ** 2) return `${bytes / (1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function AccountPlanPanel() {
  const router = useRouter();
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [message, setMessage] = useState("Loading your account plan...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getAccountPlan(API_URL)
      .then((accountPlan) => {
        if (!cancelled) {
          setPlan(accountPlan);
          setMessage("");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const detail = error instanceof Error
          ? error.message
          : "Unable to load your account plan.";
        if (detail.toLowerCase().includes("sign in") ||
            detail.toLowerCase().includes("session")) {
          clearAccessToken();
        }
        setMessage(detail);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <section aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{message}</section>;
  }

  if (!plan) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Your iePDF plan</h2>
        <p role="status" className="mt-2 text-sm text-slate-600">{message}</p>
        <button type="button" onClick={() => router.push("/login")} className="mt-4 rounded-lg bg-[#5B5CE2] px-4 py-2 font-semibold text-white hover:bg-[#494ACB]">
          Sign in
        </button>
      </section>
    );
  }

  const tools = [
    ["Merge PDF", plan.tools.merge],
    ["Split PDF", plan.tools.split],
    ["Compress PDF", plan.tools.compress],
    ["PDF to JPG", plan.tools["pdf-to-jpg"]],
    ["JPG to PDF", plan.tools["jpg-to-pdf"]],
  ] as const;

  return (
    <section aria-labelledby="account-plan-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#5B5CE2]">Account overview</p>
          <h2 id="account-plan-heading" className="mt-1 text-2xl font-bold text-slate-950">
            {plan.plan_id === "paid" ? "Paid plan" : "Free plan"}
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
          {plan.daily_task_limit === null ? "Unlimited daily tasks" : `${plan.daily_task_limit} tasks per day`}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Ads</p>
          <p className="mt-1 font-semibold text-slate-950">{plan.show_ads ? "Shown on supported pages" : "Disabled"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Watermark policy</p>
          <p className="mt-1 font-semibold text-slate-950">{plan.watermark_enabled ? "Enabled by plan" : "Not required by plan"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Priority eligibility</p>
          <p className="mt-1 font-semibold text-slate-950">{plan.priority_eligible ? "Eligible" : "Not eligible"}</p>
          {plan.priority_eligible && <p className="mt-1 text-xs text-slate-500">Eligibility does not guarantee priority processing.</p>}
        </div>
      </div>

      <h3 className="mt-7 text-lg font-semibold text-slate-950">Tool limits</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-3 pr-4 font-medium">Tool</th>
              <th className="py-3 pr-4 font-medium">Files per task</th>
              <th className="py-3 pr-4 font-medium">Max per file</th>
              <th className="py-3 font-medium">Max total</th>
            </tr>
          </thead>
          <tbody>
            {tools.map(([name, limit]) => (
              <tr key={name} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="py-3 pr-4 font-medium text-slate-950">{name}</th>
                <td className="py-3 pr-4 text-slate-700">{limit.min_files}–{limit.max_files}</td>
                <td className="py-3 pr-4 text-slate-700">{formatBytes(limit.max_file_size_bytes)}</td>
                <td className="py-3 text-slate-700">{formatBytes(limit.max_total_size_bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
