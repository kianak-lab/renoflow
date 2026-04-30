"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleIcon from "@/components/auth/google-icon";
import {
  authDividerLineClass,
  authFooterLinkClass,
  authFooterMutedClass,
  authForgotLinkClass,
  authGoogleBtnClass,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
} from "@/components/auth/auth-form-styles";

const SUPABASE_AUTH_CALLBACK_URL =
  "https://www.renoflowapp.com/api/auth/callback";

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
      const { error: oErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: SUPABASE_AUTH_CALLBACK_URL },
      });
      if (oErr) throw new Error(oErr.message);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error === "auth" && (
        <p className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage ?? "Sign-in failed."}
        </p>
      )}
      {errorMessage && error !== "auth" && (
        <p className="rounded-none bg-neutral-100 px-3 py-2 text-sm text-neutral-800">
          {errorMessage}
        </p>
      )}
      {formError && (
        <p className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            EMAIL
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@company.com"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="password" className={authLabelClass}>
            PASSWORD
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="••••••••"
            disabled={loading}
          />
        </div>
        <div className="-mt-1 flex justify-end">
          <Link href="/forgot-password" className={authForgotLinkClass}>
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={loading} className={authPrimaryBtnClass}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className={authDividerLineClass} />
        <span className="shrink-0 text-xs font-medium text-[#717171]">Or</span>
        <div className={authDividerLineClass} />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void onGoogle()}
        className={authGoogleBtnClass}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className={authFooterMutedClass}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={authFooterLinkClass}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
