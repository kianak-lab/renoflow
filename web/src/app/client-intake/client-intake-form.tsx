"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function ClientIntakeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("t")?.trim() ?? "";

  const [preview, setPreview] = useState<{
    ok: boolean;
    error?: string;
    contractorLabel?: string;
  } | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ warning?: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setPreview({ ok: false, error: "No link token. Ask your contractor for a valid invite link." });
      return;
    }
    let cancelled = false;
    fetch(`/api/client-intake/preview?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setPreview(j);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview({ ok: false, error: "Could not verify this link." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !fullName.trim()) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/client-intake/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          warning?: string;
        };
        if (!res.ok) {
          alert(j.error ?? "Could not save. Try again or contact your contractor.");
          return;
        }
        setDone({ warning: j.warning });
      } catch {
        alert("Network error.");
      } finally {
        setSubmitting(false);
      }
    },
    [token, fullName, phone, email, address, notes],
  );

  if (!token) {
    return (
      <main className="intake-shell">
        <p className="intake-err">Missing invite link.</p>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="intake-shell">
        <p className="intake-muted">Checking your link…</p>
      </main>
    );
  }

  if (!preview.ok) {
    return (
      <main className="intake-shell">
        <h1 className="intake-h1">Link unavailable</h1>
        <p className="intake-err">{preview.error ?? "This link is not valid."}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="intake-shell">
        <div className="intake-card intake-success">
          <div className="intake-success-ic">✓</div>
          <h1 className="intake-h1">Thank you</h1>
          <p className="intake-lead">Your details were sent to {preview.contractorLabel ?? "your contractor"}.</p>
          {done.warning ? <p className="intake-warn">{done.warning}</p> : null}
          <p className="intake-muted">You can close this page.</p>
        </div>
      </main>
    );
  }

  const who = preview.contractorLabel ?? "your contractor";

  return (
    <main className="intake-shell">
      <div className="intake-card">
        <p className="intake-kicker">Message from {who}</p>
        <h1 className="intake-h1">Your contact details</h1>
        <p className="intake-lead">
          Please fill in the form below so we have your information on file for your project.
        </p>
        <form className="intake-form" onSubmit={onSubmit}>
          <label className="intake-field">
            <span className="intake-label">Full name *</span>
            <input
              className="intake-input"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </label>
          <label className="intake-field">
            <span className="intake-label">Phone</span>
            <input
              className="intake-input"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(416) 555-0100"
            />
          </label>
          <label className="intake-field">
            <span className="intake-label">Email</span>
            <input
              className="intake-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </label>
          <label className="intake-field">
            <span className="intake-label">Address</span>
            <input
              className="intake-input"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Toronto ON"
            />
          </label>
          <label className="intake-field">
            <span className="intake-label">Notes</span>
            <textarea
              className="intake-textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Parking, access, best time to call…"
            />
          </label>
          <button type="submit" className="intake-submit" disabled={submitting}>
            {submitting ? "Sending…" : "Submit"}
          </button>
        </form>
      </div>
      <p className="intake-foot">
        <button type="button" className="intake-linkbtn" onClick={() => router.push("/login")}>
          Contractor sign-in
        </button>
      </p>
    </main>
  );
}
