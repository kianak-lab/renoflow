import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side client access." },
      { status: 500 },
    );
  }

  const { id: clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client id." }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabase
    .from("clients")
    .select("id,user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row || (row as { user_id: string }).user_id !== auth.uid) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { error: delErr } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", auth.uid);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
