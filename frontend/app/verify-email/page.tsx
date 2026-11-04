"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { API_URL } from "@/lib/api";

type VerificationState =
  | "loading"
  | "ready"
  | "verifying"
  | "verified"
  | "invalid"
  | "error";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<VerificationState>("loading");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token");

    if (!value || value.length > 512) {
      setState("invalid");
      return;
    }

    setToken(value);
    setState("ready");
  }, []);

  async function verifyEmail() {
    if (!token || state === "verifying") return;

    setState("verifying");

    try {
      const response = await fetch(`${API_URL}/accounts/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setToken("");
        setState("verified");
        window.history.replaceState({}, "", "/verify-email");
        return;
      }

      if (response.status === 400 || response.status === 422) {
        setToken("");
        setState("invalid");
        window.history.replaceState({}, "", "/verify-email");
        return;
      }

      setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="flex min-h-[65vh] items-center justify-center px-5 py-12">
      <section
        aria-labelledby="verification-heading"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5B5CE2]">
          iePDF account
        </p>

        <h1
          id="verification-heading"
          className="mt-3 text-2xl font-bold text-slate-950"
        >
          Verify your email
        </h1>

        <div className="mt-4 text-sm leading-6 text-slate-600" aria-live="polite">
          {state === "loading" && <p>Checking your verification link…</p>}

          {state === "ready" && (
            <p>
              Select the button below to verify your email address and activate
              your account.
            </p>
          )}

          {state === "verifying" && <p>Verifying your email address…</p>}

          {state === "verified" && (
            <p role="status">
              Your email has been verified successfully. Your account is active.
            </p>
          )}

          {state === "invalid" && (
            <p role="alert">
              This verification link is missing, invalid, or expired. Request a
              new verification email if registration is available.
            </p>
          )}

          {state === "error" && (
            <p role="alert">
              We could not complete verification right now. Please try again.
            </p>
          )}
        </div>

        {state === "ready" && (
          <button
            type="button"
            onClick={verifyEmail}
            className="mt-7 w-full rounded-xl bg-[#5B5CE2] px-5 py-3 font-semibold text-white transition hover:bg-[#494ACB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
          >
            Verify email
          </button>
        )}

        {state === "error" && (
          <button
            type="button"
            onClick={verifyEmail}
            className="mt-7 w-full rounded-xl bg-[#5B5CE2] px-5 py-3 font-semibold text-white transition hover:bg-[#494ACB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
          >
            Try again
          </button>
        )}

        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-[#5B5CE2] hover:underline"
        >
          Return to iePDF
        </Link>
      </section>
    </main>
  );
}
