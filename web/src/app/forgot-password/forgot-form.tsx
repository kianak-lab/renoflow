"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/")}`,
      });
      if (error) throw new Error(error.message);
      setMessage("If an account exists for that email, we sent a reset link.");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[#444]">
        Enter your email and we&apos;ll send a link to reset your password.
      </p>
      {formError && (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
      )}
      {message && (
        <p className="rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#222]"
          >
            Email
          </label>
          <input
            id="forgot-email"
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-[#0f2318] py-3 text-sm font-semibold text-white transition hover:bg-[#162e20] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-center text-sm text-[#444]">
        <Link href="/login" className="font-semibold text-[#4a9a6a] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
