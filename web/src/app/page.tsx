import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOnboardingEveryVisitMode } from "@/lib/onboarding-env";
import { ONBOARDING_BYPASS_COOKIE, ONBOARDING_BYPASS_VALUE } from "@/lib/onboarding-bypass-cookie";
import { shouldShowOnboarding } from "@/lib/should-show-onboarding";
import { getSessionSupabaseUid } from "@/lib/session-uid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionSupabaseUid();
  if (!session.ok) {
    redirect("/login?next=%2F");
  }
  const jar = await cookies();
  if (jar.get(ONBOARDING_BYPASS_COOKIE)?.value === ONBOARDING_BYPASS_VALUE) {
    redirect("/final");
  }
  if (isOnboardingEveryVisitMode()) {
    redirect("/onboarding");
  }
  if (await shouldShowOnboarding(session.uid)) {
    redirect("/onboarding");
  }
  redirect("/final");
}
