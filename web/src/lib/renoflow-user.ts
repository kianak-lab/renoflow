/** Optional: Supabase `auth.users.id` UUID for server-side API routes (RLS / row ownership). */
export function getRenoflowSupabaseUserId(): string | undefined {
  const id = process.env.RENOFLOW_SUPABASE_USER_ID?.trim();
  return id || undefined;
}
