/**
 * When true, home always opens onboarding; page also calls API to set onboarding_completed = false on load.
 * For launch, set to false and rely on profiles.onboarding_completed in Supabase.
 */
export function shouldResetOnboardingOnEachVisit(): boolean {
  return process.env.NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT === "true";
}

export function isOnboardingEveryVisitMode(): boolean {
  return shouldResetOnboardingOnEachVisit();
}
