/**
 * When true, onboarding client may reset onboarding_completed; home and /final send users through onboarding.
 * `next dev` defaults to this behavior so you see the flow without setting .env.
 * Set `NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT=false` in production to rely only on Supabase.
 * Set `NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT=true` to force the same "always play" in production builds.
 */
export function shouldResetOnboardingOnEachVisit(): boolean {
  if (process.env.NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT === "true") {
    return true;
  }
  if (process.env.NEXT_PUBLIC_RESET_ONBOARDING_ON_EACH_VISIT === "false") {
    return false;
  }
  return process.env.NODE_ENV === "development";
}

export function isOnboardingEveryVisitMode(): boolean {
  return shouldResetOnboardingOnEachVisit();
}
