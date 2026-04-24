import { redirect } from "next/navigation";
import { isOnboardingEveryVisitMode } from "@/lib/onboarding-env";
import { getProfileByUserId } from "@/lib/profile-service";
import { getSessionSupabaseUid } from "@/lib/session-uid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionSupabaseUid();
  if (!session.ok) {
    redirect("/login?next=%2F");
  }
  if (isOnboardingEveryVisitMode()) {
    redirect("/onboarding");
  }
  const p = await getProfileByUserId(session.uid);
  if (!p.ok) {
    redirect("/onboarding");
  }
  if (!p.row || !p.row.onboarding_completed) {
    redirect("/onboarding");
  }
  redirect("/final");
}
