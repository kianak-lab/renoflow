import { redirect } from "next/navigation";
import { isOnboardingEveryVisitMode } from "@/lib/onboarding-env";
import { getProfileByUserId } from "@/lib/profile-service";
import { getSessionSupabaseUid } from "@/lib/session-uid";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/final";
  return next;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await getSessionSupabaseUid();
  if (!session.ok) {
    redirect("/login?next=%2Fonboarding");
  }
  const sp = await searchParams;
  if (!isOnboardingEveryVisitMode()) {
    const p = await getProfileByUserId(session.uid);
    if (p.ok && p.row?.onboarding_completed) {
      redirect(safeNext(sp.next));
    }
  }
  return <OnboardingClient nextHref={safeNext(sp.next)} />;
}
