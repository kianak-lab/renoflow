import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { getProfileByUserId } from "@/lib/profile-service";
import { profileRowToMePayload } from "@/lib/profile-me-response";

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
  const payload = profileRowToMePayload(p.row);
  return NextResponse.json(payload);
}
