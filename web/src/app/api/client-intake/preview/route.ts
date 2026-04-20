import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
  }

  const { data: row, error } = await supabase
    .from("client_intake_links")
    .select("id,expires_at,used_at,user_id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    if (isSupabaseSchemaMismatch(error)) {
      return NextResponse.json({
        ok: false,
        error: "Intake links are not configured on the server.",
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link." });
  }

  const r = row as { expires_at: string; used_at: string | null; user_id: string };
  if (r.used_at) {
    return NextResponse.json({ ok: false, error: "This form was already submitted." });
  }
  if (new Date(r.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "This link has expired." });
  }

  let contractorLabel = "Your contractor";
  const { data: prof } = await supabase
    .from("profiles")
    .select("company_name,full_name")
    .eq("id", r.user_id)
    .maybeSingle();
  if (prof) {
    const p = prof as { company_name?: string | null; full_name?: string | null };
    contractorLabel =
      (p.company_name && String(p.company_name).trim()) ||
      (p.full_name && String(p.full_name).trim()) ||
      contractorLabel;
  }

  return NextResponse.json({
    ok: true,
    expiresAt: r.expires_at,
    contractorLabel,
  });
}
