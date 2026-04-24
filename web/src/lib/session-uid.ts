import { cookies } from "next/headers";
import { COOKIE_NAME, readSessionFromCookieValue } from "@/lib/simple-auth";

export type SessionWithUid =
  | { ok: true; uid: string }
  | { ok: false; redirectLogin: true };

/**
 * Resolves Supabase user id (RENOFLOW_SUPABASE_USER_ID or session payload uid).
 */
export async function getSessionSupabaseUid(): Promise<SessionWithUid> {
  const jar = await cookies();
  const payload = await readSessionFromCookieValue(jar.get(COOKIE_NAME)?.value);
  if (!payload) {
    return { ok: false, redirectLogin: true };
  }
  const uid = payload.uid?.trim() || process.env.RENOFLOW_SUPABASE_USER_ID?.trim();
  if (!uid) {
    return { ok: false, redirectLogin: true };
  }
  return { ok: true, uid };
}
