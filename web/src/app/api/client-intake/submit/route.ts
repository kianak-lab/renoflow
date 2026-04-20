import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";
import { insertProjectLinkedToClient } from "@/lib/insert-project-linked";

export const dynamic = "force-dynamic";

type IntakeOptions = {
  new_project?: { enabled?: boolean; name?: string; address?: string | null };
  project_id?: string | null;
};

export async function POST(request: Request) {
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  let body: {
    token?: string;
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const full_name = String(body.full_name ?? "").trim();
  if (!full_name) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  const phone = body.phone != null ? String(body.phone).trim() || null : null;
  const email = body.email != null ? String(body.email).trim() || null : null;
  const address = body.address != null ? String(body.address).trim() || null : null;
  const notes = body.notes != null ? String(body.notes).trim() || null : null;

  const { data: link, error: linkErr } = await supabase
    .from("client_intake_links")
    .select("id,user_id,expires_at,used_at,options")
    .eq("token", token)
    .maybeSingle();

  if (linkErr) {
    if (isSupabaseSchemaMismatch(linkErr)) {
      return NextResponse.json({ error: "Intake is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  if (!link) {
    return NextResponse.json({ error: "Invalid link." }, { status: 404 });
  }

  const L = link as {
    id: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
    options: IntakeOptions | null;
  };

  if (L.used_at) {
    return NextResponse.json({ error: "This form was already submitted." }, { status: 409 });
  }
  if (new Date(L.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  const uid = L.user_id;
  const options = (L.options || {}) as IntakeOptions;

  const { data: client, error: cErr } = await supabase
    .from("clients")
    .insert({
      user_id: uid,
      full_name,
      phone,
      email,
      address,
      notes,
    })
    .select("id,full_name,email,phone,address,notes,updated_at")
    .single();

  if (cErr) {
    if (isSupabaseSchemaMismatch(cErr)) {
      return NextResponse.json(
        { error: "Clients table is not available. Ask your contractor to run the schema migration." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Could not create client." }, { status: 500 });
  }

  const c = client as { id: string; full_name: string };

  let warning: string | undefined;
  let project: Record<string, unknown> | undefined;

  const np = options.new_project;
  if (np && np.enabled) {
    const projName =
      String(np.name ?? "").trim() || `${full_name} — Job`;
    const projAddr =
      String(np.address ?? "").trim() || address || null;

    const { created: newProj, error: projErr } = await insertProjectLinkedToClient(supabase, uid, {
      name: projName,
      client_id: c.id,
      client_name: full_name,
      address: projAddr,
    });

    if (projErr) {
      if (!isSupabaseSchemaMismatch(projErr)) {
        warning = `Your details were saved, but a project could not be created: ${projErr.message}`;
      } else {
        warning =
          "Your details were saved; the contractor may need to create the job manually (database update pending).";
      }
    } else if (newProj) {
      project = newProj as Record<string, unknown>;
    }
  } else {
    const rawPid = options.project_id;
    const projectId =
      rawPid === null || rawPid === undefined ? "" : String(rawPid).trim();
    if (projectId) {
      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!pErr && proj?.id) {
        const { error: upErr } = await supabase
          .from("projects")
          .update({
            client_id: c.id,
            client_name: full_name,
          })
          .eq("id", projectId)
          .eq("user_id", uid);
        if (upErr && !isSupabaseSchemaMismatch(upErr)) {
          warning = `Saved your details; linking to the existing job failed: ${upErr.message}`;
        }
      }
    }
  }

  const { error: useErr } = await supabase
    .from("client_intake_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", L.id)
    .is("used_at", null);

  if (useErr) {
    console.error("client_intake_links used_at update", useErr);
  }

  return NextResponse.json({
    ok: true,
    client,
    project,
    warning,
  });
}
