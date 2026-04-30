import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { signCalendarOAuthState } from "@/lib/google-calendar-oauth-state";
import { getAuthSecret } from "@/lib/simple-auth";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = getAuthSecret();
  if (!secret) {
    return NextResponse.json({ error: "RENOFLOW_AUTH_SECRET missing." }, { status: 500 });
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI.",
      },
      { status: 503 },
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const state = signCalendarOAuthState(auth.uid, secret);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
  return NextResponse.redirect(url);
}
