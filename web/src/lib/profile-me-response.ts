import type { UserProfileRow } from "@/lib/profile-service";
import { taxIdLabelFromCountry, taxPercentFromProfile } from "@/lib/profile-tax";

export type ProfileMeRow = {
  company_name: string | null;
  company_logo_url: string | null;
  full_name: string | null;
  company_phone: string | null;
  currency: string | null;
  measurement_units: string | null;
  selected_trades: string[];
  country: string | null;
  region_code: string | null;
  company_address: string | null;
  company_city: string | null;
  company_postal: string | null;
  tax_id: string | null;
};

export function profileRowToMePayload(row: UserProfileRow | null): {
  profile: ProfileMeRow;
  tax_percent: number;
  tax_id_label: "BN" | "EIN";
} {
  const st = row?.selected_trades;
  const trades = Array.isArray(st) ? (st as string[]) : [];
  const country = row?.country ?? null;
  const profile: ProfileMeRow = {
    company_name: row?.company_name ?? null,
    company_logo_url: row?.company_logo_url ?? null,
    full_name: row?.full_name ?? null,
    company_phone: row?.company_phone ?? null,
    currency: row?.currency ?? null,
    measurement_units: row?.measurement_units ?? null,
    selected_trades: trades,
    country,
    region_code: row?.region_code ?? null,
    company_address: row?.company_address ?? null,
    company_city: row?.company_city ?? null,
    company_postal: row?.company_postal ?? null,
    tax_id: row?.tax_id ?? null,
  };
  return {
    profile,
    tax_percent: taxPercentFromProfile(country, row?.region_code ?? null),
    tax_id_label: taxIdLabelFromCountry(country),
  };
}
