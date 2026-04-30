import { createServiceClient } from "@/lib/supabase-service";

export type UserProfileRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_license: string | null;
  company_address: string | null;
  company_logo_url: string | null;
  company_theme_color: string | null;
  default_markup_percent: number;
  default_tax_percent: number;
  onboarding_completed?: boolean;
  country?: string | null;
  region_code?: string | null;
  company_city?: string | null;
  company_postal?: string | null;
  tax_id?: string | null;
  selected_trades?: string[] | unknown;
  default_labour_mode?: string | null;
  default_labour_rate?: number | null;
  currency?: string | null;
  measurement_units?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getProfileByUserId(
  userId: string,
): Promise<{ ok: true; row: UserProfileRow | null } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured (SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, company_name, company_phone, company_email, company_license, company_address, company_logo_url, company_theme_color, default_markup_percent, default_tax_percent, onboarding_completed, country, region_code, company_city, company_postal, tax_id, selected_trades, default_labour_mode, default_labour_rate, currency, measurement_units, created_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: true, row: null };
  }
  const st = data.selected_trades;
  return {
    ok: true,
    row: {
      ...(data as UserProfileRow),
      selected_trades: Array.isArray(st) ? (st as string[]) : [],
    },
  };
}

export async function upsertProfile(
  userId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured (SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, ...payload, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
