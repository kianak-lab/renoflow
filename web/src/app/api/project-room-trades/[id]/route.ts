import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function normalizeSlots(raw: unknown): Array<{ date: string; duration: string; notes: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ date: string; duration: string; notes: string }> = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const row = x as Record<string, unknown>;
    const date = String(row.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    let duration = String(row.duration ?? "full").toLowerCase();
    if (duration !== "am" && duration !== "pm") duration = "full";
    const notes = String(row.notes ?? "").slice(0, 4000);
    out.push({ date, duration, notes });
  }
  return out;
}

type Ctx = { params: Promise<{ id: string }> };

/** Updates only `calendar_slots` on a project_room_trades row (no item rebuild). */
export async function PATCH(req: Request, context: Ctx) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: rtId } = await context.params;
  if (!rtId) {
    return NextResponse.json({ error: "Missing room trade id." }, { status: 400 });
  }

  let body: { calendar_slots?: unknown };
  try {
    body = (await req.json()) as { calendar_slots?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slots = normalizeSlots(body.calendar_slots);
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: rt, error: rtErr } = await supabase
    .from("project_room_trades")
    .select("id, room_id")
    .eq("id", rtId)
    .maybeSingle();

  if (rtErr) return NextResponse.json({ error: rtErr.message }, { status: 500 });
  if (!rt) return NextResponse.json({ error: "Trade row not found." }, { status: 404 });

  const roomId = String((rt as { room_id: string }).room_id);

  const { data: room, error: rmErr } = await supabase
    .from("project_rooms")
    .select("id, project_id")
    .eq("id", roomId)
    .maybeSingle();

  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const projectId = String((room as { project_id: string }).project_id);

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", auth.uid)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proj) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { error: upErr } = await supabase
    .from("project_room_trades")
    .update({ calendar_slots: slots })
    .eq("id", rtId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, calendar_slots: slots });
}
