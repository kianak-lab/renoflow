import { NextResponse } from "next/server";

/** Magic link / OAuth callbacks are disabled; app uses username + password only. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const msg =
    "Email or OAuth sign-in is not enabled. Sign in with the username and password from your server configuration.";
  return NextResponse.redirect(`${origin}/login?msg=${encodeURIComponent(msg)}`);
}
