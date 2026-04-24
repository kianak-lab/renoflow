import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import {
  ONBOARDING_BYPASS_COOKIE,
  ONBOARDING_BYPASS_VALUE,
} from "@/lib/onboarding-bypass-cookie";

export const dynamic = "force-dynamic";

/** Allows /final and home to skip the onboarding redirect until user clears (or completes onboarding, which clears in complete route). */
export async function POST() {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ONBOARDING_BYPASS_COOKIE, ONBOARDING_BYPASS_VALUE, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
