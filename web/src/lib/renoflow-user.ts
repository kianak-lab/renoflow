import { createServiceClient } from "@/lib/supabase-service";

/** Optional override: an existing Supabase `auth.users.id` UUID. */
export function getRenoflowSupabaseUserId(): string | undefined {
  const id = process.env.RENOFLOW_SUPABASE_USER_ID?.trim();
  return id || undefined;
}

/** Email used to find/create the bootstrap auth user when no override is set. */
function bootstrapEmail(username: string): string {
  const explicit = process.env.RENOFLOW_BOOTSTRAP_EMAIL?.trim();
  if (explicit) return explicit;
  const safe = username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  return `${safe || "renoflow"}@renoflow.local`;
}

type AuthUser = { id: string; email?: string | null };

/**
 * Returns a Supabase `auth.users.id` for the current login.
 * 1. Honors RENOFLOW_SUPABASE_USER_ID when set.
 * 2. Otherwise looks up an admin user by email derived from RENOFLOW_USERNAME.
 * 3. Otherwise creates one (service role) and returns the new id.
 */
export async function resolveRenoflowSupabaseUserId(
  username: string,
  password: string,
): Promise<{ uid?: string; error?: string }> {
  const override = getRenoflowSupabaseUserId();
  if (override) return { uid: override };

  const supabase = createServiceClient();
  if (!supabase) {
    return {
      error:
        "Add SUPABASE_SERVICE_ROLE_KEY to web/.env.local so the server can create your Supabase user automatically (or set RENOFLOW_SUPABASE_USER_ID to an existing auth.users id).",
    };
  }

  const email = bootstrapEmail(username);

  try {
    let page = 1;
    while (page <= 5) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) return { error: `auth.admin.listUsers: ${error.message}` };
      const users = (data?.users ?? []) as AuthUser[];
      const found = users.find(
        (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
      );
      if (found?.id) return { uid: found.id };
      if (users.length < 200) break;
      page += 1;
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not list Supabase auth users.",
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { renoflow_username: username },
  });
  if (error) return { error: `auth.admin.createUser: ${error.message}` };
  const uid = data?.user?.id;
  if (!uid) return { error: "Supabase user create returned no id." };
  return { uid };
}
