import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";

export const dynamic = "force-dynamic";

function publicBaseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function fromAddress(): string {
  const v = process.env.RESEND_FROM_EMAIL?.trim();
  if (v) return v;
  return "RenoFlow <onboarding@resend.dev>";
}

type IntakeOptions = {
  new_project?: { enabled: boolean; name?: string; address?: string | null };
  project_id?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side access." },
      { status: 500 },
    );
  }

  let body: {
    options?: IntakeOptions;
    notify_email?: string | null;
    notify_phone?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const options: IntakeOptions = body.options && typeof body.options === "object" ? body.options : {};
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insErr } = await supabase.from("client_intake_links").insert({
    user_id: auth.uid,
    token,
    expires_at: expiresAt,
    options: options as Record<string, unknown>,
  });

  if (insErr) {
    if (isSupabaseSchemaMismatch(insErr)) {
      return NextResponse.json(
        {
          error:
            "Client intake links are not set up. Run the client_intake_links section in web/supabase/schema.sql in Supabase SQL editor.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const base = publicBaseUrl(request);
  const url = `${base}/client-intake?t=${encodeURIComponent(token)}`;

  const notifyEmail = String(body.notify_email ?? "")
    .trim()
    .toLowerCase();
  const notifyPhone = String(body.notify_phone ?? "").trim();

  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (notifyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail) && resendKey) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("company_name,full_name")
      .eq("id", auth.uid)
      .maybeSingle();
    const co =
      (prof as { company_name?: string; full_name?: string } | null)?.company_name?.trim() ||
      (prof as { company_name?: string; full_name?: string } | null)?.full_name?.trim() ||
      "Your contractor";

    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1612;padding:24px">
<p>Hi,</p>
<p><strong>${escapeHtml(co)}</strong> asked you to complete your contact details for an upcoming job.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:12px 20px;background:#2d7a4f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Fill out my details</a></p>
<p style="font-size:13px;color:#6a6560">Or paste this link into your browser:<br/><span style="word-break:break-all">${escapeHtml(url)}</span></p>
<p style="font-size:12px;color:#9a958e">This link expires in 7 days.</p>
</body></html>`;

    const rs = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [notifyEmail],
        subject: `${co} — please confirm your details`,
        html,
      }),
    });
    emailSent = rs.ok;
  }

  const smsBody = `Please complete your details for our job: ${url}`;
  const smsHref =
    notifyPhone.length >= 10
      ? `sms:${notifyPhone.replace(/\D/g, "")}?body=${encodeURIComponent(smsBody)}`
      : null;

  return NextResponse.json({
    url,
    token,
    expiresAt,
    emailSent,
    emailSkippedReason:
      notifyEmail && !emailSent
        ? resendKey
          ? "Could not send email (check address or Resend)."
          : "Add RESEND_API_KEY to send email automatically, or copy the link below."
        : null,
    smsHref,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
