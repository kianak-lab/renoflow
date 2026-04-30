import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-service";

export type EnsureProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ensures a public.profiles row exists for a new auth user (OAuth or email signup).
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

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      company_email: user.email ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[ensureProfileForUser]", error.code, error.message, error.details);
    return {
      ok: false,
      error: error.message || "Could not save your profile. Try again or contact support.",
    };
  }
  return { ok: true };
}
