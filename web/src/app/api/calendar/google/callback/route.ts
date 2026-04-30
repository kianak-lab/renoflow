import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getAuthSecret } from "@/lib/simple-auth";
import { google } from "googleapis";
import { verifyCalendarOAuthState } from "@/lib/google-calendar-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const origin = url.origin;
  const fail = (msg: string) =>
    NextResponse.redirect(new URL("/final?calOAuthErr=" + encodeURIComponent(msg), origin));

  if (err) {
    return fail(String(err));
  }

  const secret = getAuthSecret();
  if (!secret || !code || !state) {
    return fail("Missing OAuth parameters.");
  }

  const verified = verifyCalendarOAuthState(state, secret);
  if (!verified) {
    return fail("Invalid OAuth state.");
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return fail("Google Calendar is not configured on the server.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  let tokens;
  try {
    const tr = await oauth2Client.getToken(code);
    tokens = tr.tokens;
  } catch (e) {
    console.error("[google calendar callback]", e);
    return fail("Could not exchange OAuth code.");
  }

  if (!tokens.refresh_token) {
    return fail("No refresh token (try revoking app access in Google and connect again).");
  }

  oauth2Client.setCredentials(tokens);

  let email = "";
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    email = String(me.data.email ?? "").trim();
  } catch {
    /* optional */
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return fail("Server database not configured.");
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      google_calendar_refresh_token: tokens.refresh_token,
      google_calendar_email: email || null,
    })
    .eq("id", verified.uid);

  if (upErr) {
    console.error("[google calendar callback] profile update", upErr);
    return fail(upErr.message);
  }

  return NextResponse.redirect(new URL("/final?calOAuth=ok", origin));
}
