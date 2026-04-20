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
  const uidFromCookie = payload.uid?.trim();
  const uidFromEnv = process.env.RENOFLOW_SUPABASE_USER_ID?.trim();
  const uid = uidFromCookie || uidFromEnv;
  if (!uid) {
    return {
      ok: false,
      status: 403,
      error:
        "Supabase user id is not configured. Set RENOFLOW_SUPABASE_USER_ID in web/.env.local to your auth.users UUID (Project → Authentication → Users), then sign in again.",
    };
  }
  return { ok: true, uid };
}
