import { cookies } from "next/headers";
import { COOKIE_NAME, readSessionFromCookieValue } from "@/lib/simple-auth";

export type SessionUidResult =
  | { ok: true; uid: string }
  | { ok: false; status: number; error: string };

export async function requireSupabaseUidFromSession(): Promise<SessionUidResult> {
  const jar = await cookies();
  const payload = await readSessionFromCookieValue(jar.get(COOKIE_NAME)?.value);
  if (!payload) {
    return { ok: false, status: 401, error: "Not signed in." };
  }
  if (!payload.uid?.trim()) {
    return {
      ok: false,
      status: 403,
      error:
        "Session is missing Supabase user id. Set RENOFLOW_SUPABASE_USER_ID in web/.env.local to your auth.users id, then sign out and sign in again.",
    };
  }
  return { ok: true, uid: payload.uid.trim() };
}
