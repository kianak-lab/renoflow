import { NextResponse } from "next/server";
import { shouldShowOnboarding } from "@/lib/should-show-onboarding";
import { requireSupabaseUidFromSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

/**
 * For middleware: is this session user supposed to be on /onboarding instead of /final?
 * Called with the same session cookie; returns 401 if not signed in.
 */
export async function GET() {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json(
      { toOnboarding: false, error: auth.error },
      { status: auth.status },
    );
  }
  let toOnboarding = true;
  try {
    toOnboarding = await shouldShowOnboarding(auth.uid);
  } catch (e) {
    console.error("[onboarding/gate]", e);
    toOnboarding = true;
  }
  return NextResponse.json({ toOnboarding });
}
