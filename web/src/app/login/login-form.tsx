"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  error?: string;
  /** From auth callback when exchange fails (URL-encoded) */
  errorMessage?: string;
};

export default function LoginForm({ error, errorMessage }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signErr) {
        setFormError(signErr.message);
        return;
      }
      setSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err !== null &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : String(err);
      setFormError(
        message ||
          "Request failed. Check the browser Network tab, your .env.local values, and that you restarted npm run dev.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-zinc-600">
        Check your email — we sent you a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error === "auth" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage ?? "Sign-in failed. Request a new link below."}
        </p>
      )}
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-emerald-700/30 focus:border-emerald-700 focus:ring-2"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
