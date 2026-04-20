/** True when PostgREST reports missing table/column vs local schema (older remote DB). */
export function isSupabaseSchemaMismatch(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find the table") ||
    (m.includes("could not find") && m.includes("schema cache")) ||
    (m.includes("column") && m.includes("does not exist"))
  );
}
