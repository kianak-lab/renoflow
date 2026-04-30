import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { ONBOARDING_BYPASS_COOKIE } from "@/lib/onboarding-bypass-cookie";
import { getProfileByUserId, upsertProfile } from "@/lib/profile-service";
import { regionFromSelection, type OnboardingCountry } from "@/lib/onboarding-constants";

export const dynamic = "force-dynamic";

type Body = {
  company_name: string;
  company_logo_data?: string | null;
  country: OnboardingCountry;
  region_code: string;
  company_address: string;
  company_city: string;
  company_postal: string;
  tax_id: string;
  selected_trades: string[];
  /** Optional; defaults to existing profile or hourly + 85 for backwards compatibility. */
  default_labour_mode?: "hourly" | "per_job";
  default_labour_rate?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  measurement_units?: "imperial" | "metric";
  currency?: "CAD" | "USD";
};

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

function combineFullName(first: string, last: string): string | null {
  const f = first.trim();
  const l = last.trim();
  const combined = `${f} ${l}`.trim();
  return combined.length ? combined : null;
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.company_name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }
  const country = body.country === "US" ? "US" : "CA";
  const region = String(body.region_code ?? "").trim();
  if (!region) {
    return NextResponse.json({ error: "Region is required." }, { status: 400 });
  }
  const r = regionFromSelection(country, region);
  const tax = r ? r.taxPercent : 0;
  const trades = Array.isArray(body.selected_trades) ? body.selected_trades.map(String) : [];

  const prev = await getProfileByUserId(auth.uid);
  const p = prev.ok ? prev.row : null;
  const newLogo = body.company_logo_data?.trim();

  const mode =
    body.default_labour_mode === "per_job"
      ? "per_job"
      : body.default_labour_mode === "hourly"
        ? "hourly"
        : p?.default_labour_mode === "per_job"
          ? "per_job"
          : "hourly";

  const rate =
    body.default_labour_rate !== undefined && body.default_labour_rate !== null
      ? num(body.default_labour_rate, 85)
      : num(p?.default_labour_rate, 85);

  const fullName = combineFullName(String(body.first_name ?? ""), String(body.last_name ?? ""));
  const phone = String(body.phone ?? "").trim() || null;
  const units = body.measurement_units === "metric" ? "metric" : "imperial";
  const currency =
    body.currency === "CAD" || body.currency === "USD"
      ? body.currency
      : country === "CA"
        ? "CAD"
        : "USD";

  const row = {
    company_name: name,
    company_logo_url: newLogo || p?.company_logo_url || null,
    country,
    region_code: region,
    company_address: String(body.company_address ?? "").trim() || null,
    company_city: String(body.company_city ?? "").trim() || null,
    company_postal: String(body.company_postal ?? "").trim() || null,
    tax_id: String(body.tax_id ?? "").trim() || null,
    selected_trades: trades,
    default_labour_mode: mode,
    default_labour_rate: rate,
    default_tax_percent: tax,
    default_markup_percent: p?.default_markup_percent ?? 20,
    onboarding_completed: true,
    full_name: fullName ?? p?.full_name ?? null,
    company_phone: phone ?? p?.company_phone ?? null,
    currency,
    measurement_units: units,
  };
  const u = await upsertProfile(auth.uid, row);
  if (!u.ok) {
    return NextResponse.json({ error: u.error }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ONBOARDING_BYPASS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
