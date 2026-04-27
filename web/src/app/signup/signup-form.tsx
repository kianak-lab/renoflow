"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoogleIcon from "@/components/auth/google-icon";
import {
  authDividerLineClass,
  authFooterLinkClass,
  authFooterMutedClass,
  authGoogleBtnClass,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
} from "@/components/auth/auth-form-styles";
import {
  buildOAuthRedirectTo,
  logOAuthRedirectTo,
} from "@/lib/auth-public-origin";

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
      const emailRedirectTo = buildOAuthRedirectTo("/");
      logOAuthRedirectTo(emailRedirectTo, "signup email confirm");
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo },
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
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));
      const redirectTo = buildOAuthRedirectTo(next);
      logOAuthRedirectTo(redirectTo, "signup Google");
      const { error: oErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (oErr) throw new Error(oErr.message);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Google sign-up failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {formError && (
        <p className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}
      {success && (
        <p className="rounded-none bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="signup-email" className={authLabelClass}>
            EMAIL
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className={authLabelClass}>
            PASSWORD
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
            className={authInputClass}
            placeholder="At least 8 characters"
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading} className={authPrimaryBtnClass}>
          {loading ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/login" className={authFooterLinkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
