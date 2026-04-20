import type { SupabaseClient } from "@supabase/supabase-js";
import { nextQuoteNumberForUser } from "@/lib/project-sequences";

export async function insertProjectLinkedToClient(
  supabase: SupabaseClient,
  uid: string,
  params: {
    name: string;
    client_id: string;
    client_name: string;
    address: string | null;
  },
) {
  const quote_number = await nextQuoteNumberForUser(supabase, uid);
  const insertPayload: Record<string, unknown> = {
    user_id: uid,
    name: params.name,
    client_id: params.client_id,
    client_name: params.client_name,
    address: params.address,
    quote_number,
  };
  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  const companyId = (company as { id?: string } | null)?.id;
  if (companyId) insertPayload.company_id = companyId;

  let { data: created, error } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select("id,name,client_id,client_name,address,quote_number,updated_at")
    .single();

  if (error && "company_id" in insertPayload) {
    ({ data: created, error } = await supabase
      .from("projects")
      .insert({
        user_id: uid,
        name: params.name,
        client_id: params.client_id,
        client_name: params.client_name,
        address: params.address,
        quote_number,
      })
      .select("id,name,client_id,client_name,address,quote_number,updated_at")
      .single());
  }

  return { created, error };
}
