import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";

export const dynamic = "force-dynamic";

type PatchBody = {
  name?: string;
  client_id?: string | null;
  client_name?: string | null;
  address?: string | null;
  quote_number?: string | null;
  notes?: string | null;
  /** ISO date string YYYY-MM-DD or empty to clear */
  deadline_date?: string | null;
  /** ISO date string YYYY-MM-DD or empty to clear */
  start_date?: string | null;
  /** Soft-hide project from active lists */
  archived?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row || row.user_id !== auth.uid) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    patch.name = name || "Untitled project";
  }
  if (body.address !== undefined) {
    const v = String(body.address ?? "").trim();
    patch.address = v || null;
  }
  if (body.quote_number !== undefined) {
    const v = String(body.quote_number ?? "").trim();
    patch.quote_number = v || "Q-001";
  }
  if (body.notes !== undefined) {
    const v = String(body.notes ?? "").trim();
    patch.notes = v || null;
  }

  if (body.deadline_date !== undefined) {
    const raw = body.deadline_date;
    if (raw === null || raw === "") {
      patch.deadline_date = null;
    } else {
      const v = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        patch.deadline_date = v;
      } else {
        return NextResponse.json({ error: "deadline_date must be YYYY-MM-DD." }, { status: 400 });
      }
    }
  }

  if (body.start_date !== undefined) {
    const raw = body.start_date;
    if (raw === null || raw === "") {
      patch.start_date = null;
    } else {
      const v = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        patch.start_date = v;
      } else {
        return NextResponse.json({ error: "start_date must be YYYY-MM-DD." }, { status: 400 });
      }
    }
  }

  if (body.client_id !== undefined) {
    const raw = body.client_id;
    if (raw === null || raw === "") {
      patch.client_id = null;
      if (body.client_name !== undefined) {
        const cn = String(body.client_name ?? "").trim();
        patch.client_name = cn || null;
      }
    } else {
      const cid = String(raw).trim();
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id,full_name")
        .eq("id", cid)
        .eq("user_id", auth.uid)
        .maybeSingle();
      if (cErr) {
        if (isSupabaseSchemaMismatch(cErr)) {
          return NextResponse.json(
            { error: "Clients table is not available in this database. Apply web/supabase/schema.sql or skip client linking." },
            { status: 503 },
          );
        }
        return NextResponse.json({ error: cErr.message }, { status: 500 });
      }
      if (!client) {
        return NextResponse.json({ error: "Client not found or not yours." }, { status: 400 });
      }
      patch.client_id = client.id;
      patch.client_name = client.full_name;
    }
  } else if (body.client_name !== undefined) {
    const cn = String(body.client_name ?? "").trim();
    patch.client_name = cn || null;
  }

  if (body.archived !== undefined) {
    patch.archived = Boolean(body.archived);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  let updated: Record<string, unknown> | null = null;
  let upErr = null as { message: string } | null;

  const attempt = async (p: Record<string, unknown>) =>
    supabase
      .from("projects")
      .update(p)
      .eq("id", projectId)
      .eq("user_id", auth.uid)
      .select("*")
      .single();

  let res = await attempt(patch);
  updated = res.data as Record<string, unknown> | null;
  upErr = res.error;

  if (upErr && isSupabaseSchemaMismatch(upErr)) {
    const noNotes = { ...patch };
    delete noNotes.notes;
    res = await attempt(noNotes);
    updated = res.data as Record<string, unknown> | null;
    upErr = res.error;
  }

  if (upErr && isSupabaseSchemaMismatch(upErr)) {
    const noLink = { ...patch };
    delete noLink.notes;
    delete noLink.client_id;
    res = await attempt(noLink);
    updated = res.data as Record<string, unknown> | null;
    upErr = res.error;
  }

  if (upErr && isSupabaseSchemaMismatch(upErr)) {
    const noDates = { ...patch };
    delete noDates.deadline_date;
    delete noDates.start_date;
    res = await attempt(noDates);
    updated = res.data as Record<string, unknown> | null;
    upErr = res.error;
  }

  if (upErr || !updated) {
    return NextResponse.json(
      { error: upErr?.message ?? "Could not update project." },
      { status: 500 },
    );
  }

  let linked: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null = null;
  const cid = typeof updated.client_id === "string" ? updated.client_id : null;
  if (cid) {
    const { data: cl, error: clErr } = await supabase
      .from("clients")
      .select("id,full_name,email,phone,address")
      .eq("id", cid)
      .eq("user_id", auth.uid)
      .maybeSingle();
    if (!clErr && cl) linked = cl;
  }

  return NextResponse.json({
    project: {
      ...updated,
      notes: typeof updated.notes === "string" || updated.notes === null ? updated.notes : null,
      client: linked,
    },
  });
}

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
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side project access." },
      { status: 500 },
    );
  }

  const { id: projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row || (row as { user_id: string }).user_id !== auth.uid) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error: delErr } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", auth.uid);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
