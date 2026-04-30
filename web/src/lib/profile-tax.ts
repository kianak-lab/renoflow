import { regionFromSelection } from "@/lib/onboarding-constants";

/** Sales-tax percent for quotes/invoices: US → 0; CA uses region table or 5% GST fallback. */
export function taxPercentFromProfile(country: string | null | undefined, regionCode: string | null | undefined): number {
  const c = country === "US" ? "US" : "CA";
  if (c === "US") return 0;
  const rc = String(regionCode ?? "").trim();
  const r = rc ? regionFromSelection("CA", rc) : null;
  if (r) return r.taxPercent;
  return 5;
}

export function taxIdLabelFromCountry(country: string | null | undefined): "BN" | "EIN" {
  return country === "US" ? "EIN" : "BN";
}
