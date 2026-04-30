import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-service";

export type EnsureProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ensures a public.profiles row exists for a new auth user (OAuth or email signup).
 * Inserts only columns that exist on every DB (avoids stale PostgREST schema cache / missing optional columns).
 * Uses upsert with ignoreDuplicates so a duplicate is not an error (race with a DB trigger or double callback).
 */
export async function ensureProfileForUser(user: User): Promise<EnsureProfileResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Server is not configured (SUPABASE_SERVICE_ROLE_KEY). Profile rows require the service role to be set on the host.",
    };
  }

  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (user.email
      ? (user.email.split("@")[0] ?? "").trim() || null
      : null) ||
    null;

  const { data, error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName ?? null,
      company_email: user.email ?? null,
      onboarding_completed: false,
      selected_trades: [],
      default_markup_percent: 20,
      default_tax_percent: 13,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[ensureProfileForUser] full error:", JSON.stringify(error));
    console.error("[ensureProfileForUser] error code:", error?.code);
    console.error("[ensureProfileForUser] error message:", error?.message);
    console.error("[ensureProfileForUser] error details:", error?.details);
    console.error("[ensureProfileForUser] error hint:", error?.hint);
    console.error("[ensureProfileForUser] response data:", data);
    return {
      ok: false,
      error: error.message || "Could not save your profile. Try again or contact support.",
    };
  }
  return { ok: true };
}
