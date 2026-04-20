import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { TN } from "@/lib/final-catalog";

export const dynamic = "force-dynamic";

type CreateRoomPayload = {
  projectId?: string;
  projectName?: string;
  roomName?: string;
  roomIcon?: string | null;
  roomSortOrder?: number;
  trades?: string[];
};

/** Server routes must use the service role key so inserts are not blocked by RLS. */
function getSupabaseForRoomWrites(): SupabaseClient | null {
  return createServiceClient() as SupabaseClient | null;
}

/** Slugs must exist in `trade_catalog.id` (e.g. demo, framing). */
async function filterValidTradeSlugs(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<{ valid: string[]; missing: string[] }> {
  const normalized = [
    ...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ];
  if (normalized.length === 0) return { valid: [], missing: [] };

  const { data, error } = await supabase.from("trade_catalog").select("id").in("id", normalized);
  if (error) throw new Error(`trade_catalog: ${error.message}`);
  const have = new Set((data ?? []).map((r: { id: string }) => r.id));
  const valid: string[] = [];
  const missing: string[] = [];
  for (const s of normalized) {
    if (have.has(s)) valid.push(s);
    else missing.push(s);
  }
  return { valid, missing };
}

async function getOrCreateProjectId(
  supabase: SupabaseClient,
  projectName: string,
  userId: string,
): Promise<string> {
  const { data: found, error: findErr } = await supabase
    .from("projects")
    .select("id")
    .eq("name", projectName)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (findErr) throw new Error(`projects lookup: ${findErr.message}`);
  const foundId = (found as { id?: string } | null)?.id;
  if (foundId) return foundId;

  const insertPayload: Record<string, unknown> = {
    name: projectName,
    user_id: userId,
  };

  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  const companyId = (company as { id?: string } | null)?.id;
  if (companyId) insertPayload.company_id = companyId;

  let { data: created, error } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && "company_id" in insertPayload) {
    ({ data: created, error } = await supabase
      .from("projects")
      .insert({ name: projectName, user_id: userId })
      .select("id")
      .single());
  }

  if (error) throw new Error(`projects insert: ${error.message}`);
  const id = (created as { id?: string } | null)?.id;
  if (!id) throw new Error("projects insert returned no id.");
  return id;
}

export async function POST(request: Request) {
  try {
    const auth = await requireSupabaseUidFromSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseForRoomWrites();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Add SUPABASE_SERVICE_ROLE_KEY to web/.env.local. The anon key cannot insert into projects/rooms when RLS is enabled (you would see “violates row-level security policy”). Restart npm run dev after saving.",
        },
        { status: 503 },
      );
    }

    let payload: CreateRoomPayload;
    try {
      payload = (await request.json()) as CreateRoomPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const roomName = String(payload.roomName ?? "").trim();
    const projectName = String(payload.projectName ?? "My Renovation").trim();
    const explicitProjectId = String(payload.projectId ?? "").trim();
    const roomIcon = payload.roomIcon ?? null;
    const roomSortOrder = Number(payload.roomSortOrder ?? 0);
    const tradeSlugs = Array.isArray(payload.trades)
      ? payload.trades.filter((x) => typeof x === "string" && x.trim().length > 0)
      : [];

    if (!roomName) {
      return NextResponse.json({ error: "roomName is required." }, { status: 400 });
    }

    const projectId = explicitProjectId
      ? explicitProjectId
      : await getOrCreateProjectId(supabase, projectName, auth.uid);

    const { data: room, error: roomError } = await supabase
      .from("project_rooms")
      .insert({
        project_id: projectId,
        name: roomName,
        icon: roomIcon,
        sort_order: Number.isFinite(roomSortOrder) ? roomSortOrder : 0,
        dimensions: {},
      })
      .select("id")
      .single();

    if (roomError) throw new Error(`project_rooms insert: ${roomError.message}`);
    const roomId = (room as { id?: string } | null)?.id;
    if (!roomId) throw new Error("project_rooms insert returned no id.");

    let tradeWarning: string | undefined;

    if (tradeSlugs.length > 0) {
      const { valid, missing } = await filterValidTradeSlugs(supabase, tradeSlugs);
      if (missing.length > 0) {
        tradeWarning =
          `No trade_catalog row for: ${missing.join(", ")}. ` +
          `Seed trade_catalog in Supabase (see web/supabase/schema.sql) so ids match RenoFlow keys (demo, framing, …). ` +
          `Room was saved without those trades.`;
      }

      if (valid.length > 0) {
        const rows = valid.map((slug, index) => ({
          room_id: roomId,
          trade_id: slug,
          display_name: TN[slug] ?? slug,
          note: "",
          is_open: false,
          days: 0,
          days_custom: false,
          sort_order: index,
        }));

        const { error: rtError } = await supabase.from("project_room_trades").insert(rows);
        if (rtError) throw new Error(`project_room_trades insert: ${rtError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      projectId,
      roomId,
      tradeCount: tradeSlugs.length,
      ...(tradeWarning ? { warning: tradeWarning } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/rooms/create]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
