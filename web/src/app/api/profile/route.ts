import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { type OnboardingCountry } from "@/lib/onboarding-constants";
import { getProfileByUserId, upsertProfile } from "@/lib/profile-service";
import { taxPercentFromProfile } from "@/lib/profile-tax";

export const dynamic = "force-dynamic";

type PatchBody = Partial<{
  company_name: string;
  company_logo_data: string | null;
  country: OnboardingCountry;
  region_code: string;
  company_address: string;
  company_city: string;
  company_postal: string;
  tax_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  measurement_units: "imperial" | "metric";
  currency: "CAD" | "USD";
  selected_trades: string[];
}>;

function combineFullName(first: string, last: string): string | null {
  const f = first.trim();
  const l = last.trim();
  const combined = `${f} ${l}`.trim();
  return combined.length ? combined : null;
}

export async function PATCH(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prev = await getProfileByUserId(auth.uid);
  const p = prev.ok ? prev.row : null;

  const row: Record<string, unknown> = {};

  if (body.company_name !== undefined) row.company_name = String(body.company_name).trim() || null;

  if (body.company_logo_data !== undefined) {
    const raw = body.company_logo_data?.trim();
    row.company_logo_url = raw || p?.company_logo_url || null;
  }

  let country = p?.country ?? null;
  if (body.country !== undefined) {
    country = body.country === "US" ? "US" : "CA";
    row.country = country;
  }

  if (body.region_code !== undefined) {
    row.region_code = String(body.region_code).trim() || null;
  }

  const region = body.region_code !== undefined ? String(body.region_code).trim() : (p?.region_code ?? "");
  const tax = taxPercentFromProfile(country, region || null);
  row.default_tax_percent = tax;

  if (body.company_address !== undefined) row.company_address = String(body.company_address).trim() || null;
  if (body.company_city !== undefined) row.company_city = String(body.company_city).trim() || null;
  if (body.company_postal !== undefined) row.company_postal = String(body.company_postal).trim() || null;
  if (body.tax_id !== undefined) row.tax_id = String(body.tax_id).trim() || null;

  if (body.phone !== undefined) row.company_phone = String(body.phone).trim() || null;

  if (body.first_name !== undefined || body.last_name !== undefined) {
    const fn = body.first_name !== undefined ? String(body.first_name) : "";
    const ln = body.last_name !== undefined ? String(body.last_name) : "";
    const combined = combineFullName(fn, ln);
    if (combined != null) row.full_name = combined;
    else if (body.first_name !== undefined || body.last_name !== undefined) row.full_name = p?.full_name ?? null;
  }

  if (body.measurement_units !== undefined) {
    row.measurement_units = body.measurement_units === "metric" ? "metric" : "imperial";
  }

  if (body.currency !== undefined) {
    row.currency = body.currency === "USD" ? "USD" : "CAD";
  } else if (body.country !== undefined) {
    row.currency = country === "US" ? "USD" : "CAD";
  }

  if (body.selected_trades !== undefined) {
    row.selected_trades = Array.isArray(body.selected_trades) ? body.selected_trades.map(String) : [];
  }

  const u = await upsertProfile(auth.uid, row);
  if (!u.ok) {
    return NextResponse.json({ error: u.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
