"use client";

import { useState } from "react";

type Props = {
  error?: string;
  errorMessage?: string;
};

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/final";
  if (next === "/" || next.startsWith("/final")) return next;
  return "/final";
}

export default function LoginForm({ error, errorMessage }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Sign-in failed.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));
      window.location.assign(next);
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
      setFormError(message || "Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error === "auth" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage ?? "Sign-in failed."}
        </p>
      )}
      {errorMessage && error !== "auth" && (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{errorMessage}</p>
      )}
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {formError}
        </p>
      )}
      <div>
        <label
          htmlFor="username"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-emerald-700/30 focus:border-emerald-700 focus:ring-2"
          placeholder="Username"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-emerald-700/30 focus:border-emerald-700 focus:ring-2"
          placeholder="Password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        Credentials come from <span className="font-mono">RENOFLOW_USERNAME</span> and{" "}
        <span className="font-mono">RENOFLOW_PASSWORD</span> (defaults:{" "}
        <span className="font-mono">renoflow</span> / <span className="font-mono">renoflow</span> if
        unset). Use <span className="font-mono">RENOFLOW_AUTH_SECRET</span> in production. API
        routes that talk to Supabase also need <span className="font-mono">RENOFLOW_SUPABASE_USER_ID</span>{" "}
        and <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>.
      </p>
    </form>
  );
}
