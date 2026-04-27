"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleIcon from "@/components/auth/google-icon";

type Props = {
  error?: string;
  errorMessage?: string;
};

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (
    next === "/" ||
    next.startsWith("/final") ||
    next.startsWith("/onboarding") ||
    next.startsWith("/projects")
  ) {
    return next;
  }
  return "/";
}

async function syncRenoflowSession(): Promise<void> {
  const res = await fetch("/api/auth/sync-session", {
    method: "POST",
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not establish app session.");
  }
}

export default function LoginForm({ error, errorMessage }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) throw new Error(signErr.message);
      await syncRenoflowSession();
      const params = new URLSearchParams(window.location.search);
      window.location.assign(safeNextPath(params.get("next")));
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));
      const { error: oErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oErr) throw new Error(oErr.message);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error === "auth" && (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage ?? "Sign-in failed."}
        </p>
      )}
      {errorMessage && error !== "auth" && (
        <p className="rounded-sm bg-neutral-100 px-3 py-2 text-sm text-neutral-800">
          {errorMessage}
        </p>
      )}
      {formError && (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#222]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-sm border border-[#d4d4d4] bg-white px-3 py-2.5 text-[#222] outline-none focus:border-[#0f2318] focus:ring-1 focus:ring-[#0f2318]"
            placeholder="you@company.com"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#222]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-[#d4d4d4] bg-white px-3 py-2.5 text-[#222] outline-none focus:border-[#0f2318] focus:ring-1 focus:ring-[#0f2318]"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>
        <div className="-mt-1 flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[#444] underline underline-offset-2 hover:text-[#0f2318]"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-[#0f2318] py-3 text-sm font-semibold text-white transition hover:bg-[#162e20] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e5e5e5]" />
        <span className="text-xs font-medium text-[#717171]">Or</span>
        <div className="h-px flex-1 bg-[#e5e5e5]" />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void onGoogle()}
        className="flex w-full items-center justify-center gap-3 rounded-sm border border-[#dadce0] bg-white py-3 text-sm font-semibold text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-sm text-[#444]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[#4a9a6a] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
