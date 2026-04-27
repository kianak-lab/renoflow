import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Ensures a public.profiles row exists for a new auth user (OAuth or email signup).
 */
export async function ensureProfileForUser(user: User): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return;

  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (user.email ? user.email.split("@")[0] : null);

  await supabase.from("profiles").insert({
    id: user.id,
    full_name: fullName,
    company_email: user.email ?? null,
  });
}
