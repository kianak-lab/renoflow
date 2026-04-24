import { NextResponse } from "next/server";
import { getProfileByUserId } from "@/lib/profile-service";
import { requireSupabaseUidFromSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const p = await getProfileByUserId(auth.uid);
  if (!p.ok) {
    return NextResponse.json({ error: p.error }, { status: 500 });
  }
  if (!p.row) {
    return NextResponse.json({
      profile: null,
      onboarding_completed: false,
    });
  }
  return NextResponse.json({
    profile: p.row,
    onboarding_completed: !!p.row.onboarding_completed,
  });
}
