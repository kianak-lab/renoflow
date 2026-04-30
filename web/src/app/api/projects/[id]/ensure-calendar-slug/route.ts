import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "job";
}

type RouteCtx = { params: Promise<{ id: string }> };

/** Allocates a unique `calendar_slug` for sharing /cal/[slug]. */
export async function POST(_request: Request, context: RouteCtx) {
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

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("id,name,user_id,calendar_slug")
    .eq("id", projectId)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proj || (proj as { user_id: string }).user_id !== auth.uid) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const row = proj as { name?: string; calendar_slug?: string | null };
  const existing = String(row.calendar_slug ?? "").trim().toLowerCase();
  if (existing) {
    return NextResponse.json({ slug: existing });
  }

  const base = slugifyName(String(row.name ?? "job"));
  const shortId = projectId.replace(/-/g, "").slice(0, 8);
  let candidate = `${base}-${shortId}`.toLowerCase();

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data: clash } = await supabase
      .from("projects")
      .select("id")
      .eq("calendar_slug", candidate)
      .maybeSingle();
    if (!clash) break;
    const suffix = randomBytes(2).toString("hex");
    candidate = `${base}-${shortId}-${suffix}`.toLowerCase();
  }

  const { error: uErr } = await supabase
    .from("projects")
    .update({ calendar_slug: candidate })
    .eq("id", projectId)
    .eq("user_id", auth.uid);

  if (uErr) {
    return NextResponse.json(
      {
        error:
          uErr.message +
          " (Apply Supabase migration 006_timeline_calendar.sql if the calendar_slug column is missing.)",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ slug: candidate });
}
