import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { upsertProfile } from "@/lib/profile-service";
import { shouldResetOnboardingOnEachVisit } from "@/lib/onboarding-env";

export const dynamic = "force-dynamic";

/**
 * Dev-only: sets onboarding_completed = false. Gated by NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT.
 */
export async function POST() {
  if (!shouldResetOnboardingOnEachVisit()) {
    return NextResponse.json({ error: "Not enabled." }, { status: 403 });
  }
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const u = await upsertProfile(auth.uid, { onboarding_completed: false });
  if (!u.ok) {
    return NextResponse.json({ error: u.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
