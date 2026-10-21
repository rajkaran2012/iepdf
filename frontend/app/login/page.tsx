"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { API_URL } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

type LoginState = "idle" | "submitting" | "error";

type LoginResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setState("submitting");

    try {
      const response = await fetch(`${API_URL}/accounts/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!response.ok) {
        setState("error");
        setMessage(
          response.status === 401
            ? "Email or password is incorrect, or the account is not active."
            : response.status === 422
              ? "Check your email address and password, then try again."
              : "Sign-in could not be completed. Please try again later."
        );
        return;
      }

      const data = (await response.json()) as LoginResponse;

      if (
        typeof data.access_token !== "string" ||
        data.access_token.length === 0 ||
        data.token_type?.toLowerCase() !== "bearer" ||
        typeof data.expires_in !== "number" ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      ) {
        setState("error");
        setMessage("The sign-in service returned an invalid response.");
        return;
      }

      setAccessToken(data.access_token, data.expires_in);

      setPassword("");
      router.push("/");
    } catch {
      setState("error");
      setMessage(
        "We could not connect to the sign-in service. Please try again later."
      );
    } finally {
      setState((current) => current === "submitting" ? "idle" : current);
    }
  }

  return (
    <main className="flex min-h-[65vh] items-center justify-center px-5 py-12">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5B5CE2]">
          iePDF account
        </p>

        <h1
          id="login-heading"
          className="mt-3 text-2xl font-bold text-slate-950"
        >
          Sign in
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with your verified, active iePDF account.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-5"
        >
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <input
              id="login-email"
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
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-[#5B5CE2] focus:ring-2 focus:ring-[#5B5CE2]/20"
            />
          </div>

          {message && (
            <p
              role="alert"
              aria-live="polite"
              className="text-sm leading-6 text-red-700"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-xl bg-[#5B5CE2] px-5 py-3 font-semibold text-white transition hover:bg-[#494ACB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Need an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[#5B5CE2] hover:underline"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
