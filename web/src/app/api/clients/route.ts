import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { isSupabaseSchemaMismatch } from "@/lib/supabase-helpers";
import { insertProjectLinkedToClient } from "@/lib/insert-project-linked";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const { data, error } = await supabase
    .from("clients")
    .select("id,full_name,email,phone,address,notes,updated_at")
    .eq("user_id", auth.uid)
    .order("full_name", { ascending: true });

  if (error) {
    if (isSupabaseSchemaMismatch(error)) {
      return NextResponse.json({ clients: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ clients: data ?? [] });
}

type PostBody = {
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  /** When set, that project row gets `client_id` + `client_name` for this user. Ignored if `new_project.enabled`. */
  project_id?: string | null;
  /** Create a new project row linked to this client (`client_id` set). */
  new_project?: {
    enabled?: boolean;
    name?: string | null;
    address?: string | null;
  };
};

export async function POST(request: Request) {
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

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const full_name = String(body.full_name ?? "").trim();
  if (!full_name) {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  }

  const insertRow = {
    user_id: auth.uid,
    full_name,
    phone: String(body.phone ?? "").trim() || null,
    email: String(body.email ?? "").trim() || null,
    address: String(body.address ?? "").trim() || null,
    notes: String(body.notes ?? "").trim() || null,
  };

  const { data: client, error: insErr } = await supabase
    .from("clients")
    .insert(insertRow)
    .select("id,full_name,email,phone,address,notes,updated_at")
    .single();

  if (insErr) {
    if (isSupabaseSchemaMismatch(insErr)) {
      return NextResponse.json(
        {
          error:
            "Clients table is not available. Run web/supabase/schema.sql in Supabase, or create the client locally.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Insert returned no row." }, { status: 500 });
  }

  const np = body.new_project;
  const wantNewProject =
    np &&
    typeof np === "object" &&
    np.enabled === true;

  if (wantNewProject) {
    const projName =
      String(np!.name ?? "").trim() || `${full_name} — Job`;
    const projAddr =
      String(np!.address ?? "").trim() || insertRow.address || null;

    const { created: newProj, error: projErr } = await insertProjectLinkedToClient(
      supabase,
      auth.uid,
      {
        name: projName,
        client_id: client.id,
        client_name: full_name,
        address: projAddr,
      },
    );

    if (projErr) {
      if (isSupabaseSchemaMismatch(projErr)) {
        return NextResponse.json(
          {
            client,
            warning:
              "Client saved; could not create a linked project (check projects.client_id exists — run web/supabase/schema.sql).",
          },
          { status: 201 },
        );
      }
      return NextResponse.json(
        {
          client,
          warning: `Client saved but new project failed: ${projErr.message}`,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { client, project: newProj ?? undefined },
      { status: 201 },
    );
  }

  const rawPid = body.project_id;
  const projectId =
    rawPid === null || rawPid === undefined ? "" : String(rawPid).trim();
  if (projectId) {
    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", auth.uid)
      .maybeSingle();
    if (!pErr && proj?.id) {
      const patch: Record<string, unknown> = {
        client_id: client.id,
        client_name: full_name,
      };
      const { error: upErr } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId)
        .eq("user_id", auth.uid);
      if (upErr && !isSupabaseSchemaMismatch(upErr)) {
        return NextResponse.json(
          {
            client,
            warning: `Client saved but project link failed: ${upErr.message}`,
          },
          { status: 201 },
        );
      }
    }
  }

  return NextResponse.json({ client }, { status: 201 });
}
