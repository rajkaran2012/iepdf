import AccountPlanPanel from "@/components/account/AccountPlanPanel";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#5B5CE2]">
          iePDF account
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Your plan and limits
        </h1>
        <p className="mt-3 mb-8 text-slate-600">
          View the plan and processing limits returned by the iePDF account service.
        </p>
        <AccountPlanPanel />
      </div>
    </main>
  );
}
