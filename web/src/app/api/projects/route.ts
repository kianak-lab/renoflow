import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";
import { nextQuoteNumberForUser } from "@/lib/project-sequences";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side project access." },
      { status: 500 },
    );
  }

  let data: Array<Record<string, unknown>> | null = null;
  let error = null as { message: string } | null;

  const rich = await supabase
    .from("projects")
    .select(
      "id,name,client_id,client_name,address,quote_number,notes,updated_at,created_at,start_date,deadline_date",
    )
    .eq("user_id", auth.uid)
    .order("updated_at", { ascending: false });

  if (rich.error && isSupabaseSchemaMismatch(rich.error)) {
    const basic = await supabase
      .from("projects")
      .select("id,name,client_id,client_name,address,quote_number,updated_at,created_at,start_date")
      .eq("user_id", auth.uid)
      .order("updated_at", { ascending: false });
    data = (basic.data ?? []) as Array<Record<string, unknown>>;
    error = basic.error;
  } else {
    data = (rich.data ?? []) as Array<Record<string, unknown>>;
    error = rich.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  /** Supabase may return uuid columns as strings; normalize so lookups always match. */
  function normalizeClientId(v: unknown): string | null {
    if (v == null || v === "") return null;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    return s === "" ? null : s;
  }

  const clientIds = [
    ...new Set(
      rows
        .map((r) => normalizeClientId(r.client_id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const byId: Record<
    string,
    { id: string; full_name: string; email: string | null; phone: string | null; address: string | null }
  > = {};
  if (clientIds.length > 0) {
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select("id,full_name,email,phone,address")
      .in("id", clientIds)
      .eq("user_id", auth.uid);
    if (cErr && !isSupabaseSchemaMismatch(cErr)) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }
    if (!cErr) {
      for (const c of clients ?? []) {
        byId[c.id] = c;
      }
    }
  }

  const projects = rows.map((r) => {
    const cid = normalizeClientId(r.client_id);
    return {
      ...r,
      client_id: cid,
      notes: typeof r.notes === "string" || r.notes === null ? r.notes : null,
      client: cid && byId[cid] ? byId[cid] : null,
    };
  });

  return NextResponse.json({ projects });
}

type PostBody = { name?: string; client?: string; address?: string; client_id?: string | null };

export async function POST(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side project access." },
      { status: 500 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim() || "New project";
  let client_name = String(body.client ?? "").trim() || null;
  const address = String(body.address ?? "").trim() || null;

  const rawCid = body.client_id;
  let linkedClientId: string | null = null;
  if (rawCid !== undefined && rawCid !== null && String(rawCid).trim() !== "") {
    const cid = String(rawCid).trim();
    const { data: clRow, error: clErr } = await supabase
      .from("clients")
      .select("id,full_name")
      .eq("id", cid)
      .eq("user_id", auth.uid)
      .maybeSingle();
    if (!clErr && clRow && typeof (clRow as { id?: string }).id === "string") {
      linkedClientId = (clRow as { id: string }).id;
      const fn = String((clRow as { full_name?: string }).full_name ?? "").trim();
      if (fn) client_name = fn;
    }
  }

  const insertPayload: Record<string, unknown> = {
    user_id: auth.uid,
    name,
    client_name,
    address,
  };
  if (linkedClientId) insertPayload.client_id = linkedClientId;

  const quoteNumber = await nextQuoteNumberForUser(supabase, auth.uid);
  insertPayload.quote_number = quoteNumber;

  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  const companyId = (company as { id?: string } | null)?.id;
  if (companyId) insertPayload.company_id = companyId;

  let { data: created, error } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select("id,name,client_id,client_name,address,quote_number,updated_at")
    .single();

  if (error && "company_id" in insertPayload) {
    const fallback: Record<string, unknown> = {
      user_id: auth.uid,
      name,
      client_name,
      address,
      quote_number: quoteNumber,
    };
    if (linkedClientId) fallback.client_id = linkedClientId;
    ({ data: created, error } = await supabase
      .from("projects")
      .insert(fallback)
      .select("id,name,client_id,client_name,address,quote_number,updated_at")
      .single());
  }

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create project." },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: created });
}
