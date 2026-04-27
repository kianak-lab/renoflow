"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleIcon from "@/components/auth/google-icon";

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

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/")}`,
        },
      });
      if (signErr) throw new Error(signErr.message);
      if (data.session) {
        await syncRenoflowSession();
        window.location.assign("/");
        return;
      }
      setSuccess(
        "Check your email to confirm your account. After confirming, you can sign in.",
      );
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setFormError(null);
    setSuccess(null);
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
      setFormError(err instanceof Error ? err.message : "Google sign-up failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {formError && (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}
      {success && (
        <p className="rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="signup-email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#222]"
          >
            Email
          </label>
          <input
            id="signup-email"
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
            htmlFor="signup-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#222]"
          >
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-[#d4d4d4] bg-white px-3 py-2.5 text-[#222] outline-none focus:border-[#0f2318] focus:ring-1 focus:ring-[#0f2318]"
            placeholder="At least 8 characters"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-[#0f2318] py-3 text-sm font-semibold text-white transition hover:bg-[#162e20] disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#4a9a6a] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
