"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { API_URL } from "@/lib/api";

type RegistrationState = "idle" | "submitting" | "accepted" | "error";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<RegistrationState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 12 || password.length > 128) {
      setMessage("Use a password between 12 and 128 characters.");
      setState("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      setState("error");
      return;
    }

    setState("submitting");

    try {
      const response = await fetch(`${API_URL}/accounts/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      if (response.status === 202) {
        setPassword("");
        setConfirmPassword("");
        setState("accepted");
        setMessage(
          "If your account can be registered, a verification email will be sent. Check your inbox and spam folder."
        );
        return;
      }

      if (response.status === 422) {
        setState("error");
        setMessage("Check your email address and password, then try again.");
        return;
      }

      if (response.status === 503) {
        setState("error");
        setMessage(
          "We could not send the verification email right now. Please try registering again later."
        );
        return;
      }

      setState("error");
      setMessage("Registration could not be completed. Please try again later.");
    } catch {
      setState("error");
      setMessage(
        "We could not connect to the registration service. Please try again later."
      );
    }
  }

  return (
    <main className="flex min-h-[65vh] items-center justify-center px-5 py-12">
      <section
        aria-labelledby="register-heading"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5B5CE2]">
          iePDF account
        </p>

        <h1
          id="register-heading"
          className="mt-3 text-2xl font-bold text-slate-950"
        >
          Create your account
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Register to get started. You will need to verify your email address
          before your account becomes active.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="register-email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-[#5B5CE2] focus:ring-2 focus:ring-[#5B5CE2]/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-[#5B5CE2] focus:ring-2 focus:ring-[#5B5CE2]/20"
              aria-describedby="password-help"
            />
            <p id="password-help" className="mt-2 text-xs text-slate-500">
              Use 12–128 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-[#5B5CE2] focus:ring-2 focus:ring-[#5B5CE2]/20"
            />
          </div>

          {message && (
            <p
              role={state === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`text-sm leading-6 ${
                state === "error" ? "text-red-700" : "text-slate-700"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-xl bg-[#5B5CE2] px-5 py-3 font-semibold text-white transition hover:bg-[#494ACB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already registered?{" "}
          <Link
            href="/"
            className="font-medium text-[#5B5CE2] hover:underline"
          >
            Return to iePDF
          </Link>
        </p>
      </section>
    </main>
  );
}
