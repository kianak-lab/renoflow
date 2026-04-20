import type { SupabaseClient } from "@supabase/supabase-js";

/** Next quote label for this user across all projects: Q-001, Q-002, … */
export async function nextQuoteNumberForUser(
  supabase: SupabaseClient,
  uid: string,
): Promise<string> {
  const { data, error } = await supabase.from("projects").select("quote_number").eq("user_id", uid);
  if (error || !data?.length) return "Q-001";
  let max = 0;
  for (const row of data) {
    const qn = String((row as { quote_number?: string }).quote_number ?? "");
    const m = qn.match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `Q-${String(max + 1).padStart(3, "0")}`;
}

/** Next invoice numeric suffix for this user (INV-001 → 1), across all projects. */
export async function nextInvoiceSequenceForUser(
  supabase: SupabaseClient,
  uid: string,
): Promise<number> {
  const { data: projs, error: pErr } = await supabase.from("projects").select("id").eq("user_id", uid);
  if (pErr || !projs?.length) return 1;
  const ids = projs.map((p) => String((p as { id: string }).id));
  const { data: invs, error: iErr } = await supabase
    .from("invoices")
    .select("invoice_number")
    .in("project_id", ids);
  if (iErr || !invs?.length) return 1;
  let max = 0;
  for (const row of invs) {
    const num = String((row as { invoice_number?: string }).invoice_number ?? "");
    const m = num.match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max + 1;
}
