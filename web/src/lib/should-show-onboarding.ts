import { getProfileByUserId } from "@/lib/profile-service";

/**
 * True if the user has not completed onboarding in Supabase (or profile row missing / load error).
 * Used by `/final` and `/api/onboarding/gate`. Does not use "dev always" mode so completed users
 * can still open /final; use the home page for that case.
 */
export async function shouldShowOnboarding(uid: string): Promise<boolean> {
  const p = await getProfileByUserId(uid);
  if (!p.ok) {
    return true;
  }
  if (!p.row) {
    return true;
  }
  return !p.row.onboarding_completed;
}
