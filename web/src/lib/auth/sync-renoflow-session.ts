/**
 * After Supabase establishes a browser session (email sign-up / sign-in),
 * mint the RenoFlow HttpOnly session cookie via the API.
 */
export async function syncRenoflowSessionAfterSupabaseAuth(): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/auth/sync-session", {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg} If this says “Load failed”, the browser could not complete the request—check Network for POST /api/auth/sync-session (blocked, offline, or server timeout).`,
    );
  }

  const text = await res.text();
  let data: { error?: string } = {};
  try {
    data = text ? (JSON.parse(text) as { error?: string }) : {};
  } catch {
    throw new Error(
      `Session sync returned non-JSON (HTTP ${res.status}). Often a crash or HTML error page—check hosting logs for /api/auth/sync-session.`,
    );
  }

  if (!res.ok) {
    throw new Error(
      data.error ||
        `Could not establish app session (HTTP ${res.status}).`,
    );
  }
}
