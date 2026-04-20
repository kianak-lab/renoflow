import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getAuthSecret,
  getExpectedPassword,
  getExpectedUsername,
} from "@/lib/simple-auth";
import { resolveRenoflowSupabaseUserId } from "@/lib/renoflow-user";

function safeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const usernameRaw =
    typeof body === "object" && body !== null && "username" in body
      ? String((body as { username: unknown }).username ?? "")
      : "";
  const passwordRaw =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as { password: unknown }).password ?? "")
      : "";
  const username = usernameRaw.trim();
  const password = passwordRaw.trim();

  const expectedUser = getExpectedUsername().trim();
  const expectedPass = getExpectedPassword();
  const secret = getAuthSecret();

  if (!secret) {
    return NextResponse.json(
      { error: "Server is not configured for sign-in (set RENOFLOW_AUTH_SECRET)." },
      { status: 500 },
    );
  }

  const userOk =
    username.toLowerCase() === expectedUser.toLowerCase() && username.length > 0;
  const passOk = safeStringEqual(password, expectedPass);
  if (!userOk || !passOk) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const { uid, error: uidError } = await resolveRenoflowSupabaseUserId(username, password);
  if (uidError) {
    return NextResponse.json({ error: uidError }, { status: 500 });
  }

  if (!uid) {
    return NextResponse.json(
      {
        error:
          "Login succeeded but no Supabase user id was returned. Check server logs and RENOFLOW_SUPABASE_USER_ID / SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  const token = await createSessionToken(secret, uid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
