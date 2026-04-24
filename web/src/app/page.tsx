import { redirect } from "next/navigation";
import { isOnboardingEveryVisitMode } from "@/lib/onboarding-env";
import { shouldShowOnboarding } from "@/lib/should-show-onboarding";
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
  if (await shouldShowOnboarding(session.uid)) {
    redirect("/onboarding");
  }
  redirect("/final");
}
