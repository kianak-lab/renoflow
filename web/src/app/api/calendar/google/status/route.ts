import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: row, error } = await supabase
    .from("profiles")
    .select("google_calendar_refresh_token,google_calendar_email")
    .eq("id", auth.uid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pr = (row ?? {}) as Record<string, unknown>;
  const token = typeof pr.google_calendar_refresh_token === "string" && pr.google_calendar_refresh_token.length > 0;
  const email = typeof pr.google_calendar_email === "string" ? pr.google_calendar_email : null;

  return NextResponse.json({
    connected: token,
    email,
    oauthConfigured: Boolean(
      process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim(),
    ),
  });
}
