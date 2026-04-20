import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

/** From address — use a domain you verify in Resend, or Resend's test sender for development. */
function fromAddress(): string {
  const v = process.env.RESEND_FROM_EMAIL?.trim();
  if (v) return v;
  return "RenoFlow <onboarding@resend.dev>";
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Email sending is not configured. Add RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) to web/.env.local.",
      },
      { status: 503 },
    );
  }

  let body: { to?: string; subject?: string; html?: string; replyTo?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid or missing recipient email." }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim() || "Invoice";
  const html = (body.html ?? "").trim();
  if (!html) {
    return NextResponse.json({ error: "Missing email body." }, { status: 400 });
  }

  const replyTo = (body.replyTo ?? "").trim();
  const payload: Record<string, unknown> = {
    from: fromAddress(),
    to: [to],
    subject,
    html,
  };
  if (replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    payload.reply_to = replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
  if (!res.ok) {
    return NextResponse.json(
      { error: json.message || `Email provider error (${res.status}).` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, id: json.id });
}
