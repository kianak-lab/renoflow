import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TB, TN, type CatalogItem } from "@/lib/final-catalog";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type TradePatch = {
  id?: string;
  note?: string;
  open?: boolean;
  days?: number;
  daysCustom?: boolean;
  items?: Array<{ id?: string; qty?: number; p?: number; wasAuto?: boolean }>;
  /** Dynamic supplier lines for Demolition (cached_products), persisted to project_trade_items. */
  demoMaterialLines?: Array<{
    code: string;
    label: string;
    unit: string;
    unit_price: number;
    quantity: number;
  }>;
  calendar_slots?: Array<{ date: string; duration?: string; notes?: string }>;
};

type PatchBody = {
  name?: string;
  icon?: string | null;
  sort_order?: number;
  dimensions?: Record<string, unknown>;
  trades?: TradePatch[];
};

function normalizeCalendarSlots(raw: unknown): Array<{ date: string; duration: string; notes: string }> {
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

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

async function assertRoomOwned(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<{ room: { id: string; project_id: string } } | { error: string; status: number }> {
  const { data: row, error: loadErr } = await supabase
    .from("project_rooms")
    .select("id,project_id")
    .eq("id", roomId)
    .maybeSingle();

  if (loadErr) {
    return { error: loadErr.message, status: 500 };
  }
  if (!row) {
    return { error: "Room not found.", status: 404 };
  }

  const projectId = (row as { project_id: string }).project_id;
  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (pErr) {
    return { error: pErr.message, status: 500 };
  }
  if (!proj) {
    return { error: "Not allowed.", status: 403 };
  }

  return { room: row as { id: string; project_id: string } };
}

/** Build `project_trade_items` rows from catalog + client overrides (same idea as `project-workspace-rooms` fetch path). */
function buildItemRows(
  slug: string,
  clientItems: TradePatch["items"],
): Array<{
  code: string;
  label: string;
  unit: string;
  unit_price: number;
  quantity: number;
  was_auto: boolean;
  sort_order: number;
}> {
  const catalog: CatalogItem[] = TB[slug] ?? TB.demo;
  const byCode = new Map<string, { id?: string; qty?: number; p?: number; wasAuto?: boolean }>();
  for (const it of clientItems ?? []) {
    const id = String(it.id ?? "").trim();
    if (id) byCode.set(id, it);
  }
  return catalog.map((row, sortOrder) => {
    const ov = byCode.get(row.id);
    return {
      code: row.id,
      label: row.l,
      unit: row.u,
      unit_price: ov?.p !== undefined ? num(ov.p, row.p) : row.p,
      quantity: num(ov?.qty, 0),
      was_auto: ov?.wasAuto === true,
      sort_order: sortOrder,
    };
  });
}

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
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const { id: roomId } = await context.params;
  if (!roomId) {
    return NextResponse.json({ error: "Missing room id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const owned = await assertRoomOwned(supabase, roomId, auth.uid);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const roomUpdate: Record<string, unknown> = {};
  if (typeof body.name === "string") roomUpdate.name = body.name.trim() || "Room";
  if (body.icon !== undefined) roomUpdate.icon = body.icon;
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    roomUpdate.sort_order = body.sort_order;
  }
  if (body.dimensions !== undefined && typeof body.dimensions === "object" && body.dimensions !== null) {
    const { data: dimRow, error: dimLoadErr } = await supabase
      .from("project_rooms")
      .select("dimensions")
      .eq("id", roomId)
      .maybeSingle();
    if (dimLoadErr) {
      return NextResponse.json({ error: dimLoadErr.message }, { status: 500 });
    }
    const prevRaw = dimRow ? (dimRow as { dimensions?: unknown }).dimensions : undefined;
    const prev =
      prevRaw && typeof prevRaw === "object" && prevRaw !== null
        ? { ...(prevRaw as Record<string, unknown>) }
        : {};
    roomUpdate.dimensions = { ...prev, ...(body.dimensions as Record<string, unknown>) };
  }

  if (Object.keys(roomUpdate).length > 0) {
    const { error: upErr } = await supabase.from("project_rooms").update(roomUpdate).eq("id", roomId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  const trades = Array.isArray(body.trades) ? body.trades : null;
  if (!trades) {
    return NextResponse.json({ ok: true });
  }

  const { data: catalogCheck, error: catErr } = await supabase.from("trade_catalog").select("id");
  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }
  const validSlugs = new Set((catalogCheck ?? []).map((r: { id: string }) => r.id));

  const normalized: Array<{ slug: string; patch: TradePatch }> = [];
  for (const t of trades) {
    const slug = String(t.id ?? "")
      .trim()
      .toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Each trade must include a non-empty id." }, { status: 400 });
    }
    if (!validSlugs.has(slug)) {
      return NextResponse.json(
        {
          error: `Trade "${slug}" is missing from trade_catalog. Seed catalog ids (demo, framing, electrical, …) in Supabase.`,
        },
        { status: 422 },
      );
    }
    normalized.push({ slug, patch: t });
  }

  const { data: existingRts, error: rtListErr } = await supabase
    .from("project_room_trades")
    .select("id,trade_id")
    .eq("room_id", roomId);

  if (rtListErr) {
    return NextResponse.json({ error: rtListErr.message }, { status: 500 });
  }

  const wanted = new Set(normalized.map((x) => x.slug));
  for (const row of existingRts ?? []) {
    const tid = String((row as { trade_id?: string }).trade_id ?? "");
    if (tid && !wanted.has(tid)) {
      const { error: delErr } = await supabase.from("project_room_trades").delete().eq("id", (row as { id: string }).id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    const { slug, patch } = normalized[i];
    const note = String(patch.note ?? "");
    const isOpen = patch.open === true;
    const days = num(patch.days, 0);
    const daysCustom = patch.daysCustom === true;

    const calendarSlots = normalizeCalendarSlots(patch.calendar_slots);

    const rowPayload: Record<string, unknown> = {
      room_id: roomId,
      trade_id: slug,
      display_name: TN[slug] ?? slug,
      note,
      is_open: isOpen,
      days,
      days_custom: daysCustom,
      sort_order: i,
      calendar_slots: calendarSlots,
    };

    const { error: upRtErr } = await supabase
      .from("project_room_trades")
      .upsert(rowPayload, { onConflict: "room_id,trade_id" });

    if (upRtErr) {
      return NextResponse.json({ error: upRtErr.message }, { status: 500 });
    }

    const { data: rtRow, error: rtOneErr } = await supabase
      .from("project_room_trades")
      .select("id")
      .eq("room_id", roomId)
      .eq("trade_id", slug)
      .maybeSingle();

    if (rtOneErr || !rtRow) {
      return NextResponse.json(
        { error: rtOneErr?.message ?? "Could not resolve room trade row." },
        { status: 500 },
      );
    }

    const rtUuid = (rtRow as { id: string }).id;

    const { error: delItemsErr } = await supabase.from("project_trade_items").delete().eq("room_trade_id", rtUuid);
    if (delItemsErr) {
      return NextResponse.json({ error: delItemsErr.message }, { status: 500 });
    }

    const itemRows =
      slug === "demo" && Array.isArray(patch.demoMaterialLines) && patch.demoMaterialLines.length > 0
        ? patch.demoMaterialLines.map((r, sortOrder) => ({
            code: String(r.code ?? "").trim() || `demo-${sortOrder}`,
            label: String(r.label ?? "Material").trim() || "Material",
            unit: String(r.unit ?? "ea").trim() || "ea",
            unit_price: num(r.unit_price, 0),
            quantity: num(r.quantity, 0),
            was_auto: false,
            sort_order: sortOrder,
          }))
        : buildItemRows(slug, patch.items);
    if (itemRows.length > 0) {
      const insertPayload = itemRows.map((r) => ({
        room_trade_id: rtUuid,
        code: r.code,
        label: r.label,
        unit: r.unit,
        unit_price: r.unit_price,
        quantity: r.quantity,
        was_auto: r.was_auto,
        sort_order: r.sort_order,
      }));

      const { error: insErr } = await supabase.from("project_trade_items").insert(insertPayload);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
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
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const { id: roomId } = await context.params;
  if (!roomId) {
    return NextResponse.json({ error: "Missing room id." }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabase
    .from("project_rooms")
    .select("id,project_id")
    .eq("id", roomId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const projectId = (row as { project_id: string }).project_id;
  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", auth.uid)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!proj) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error: delErr } = await supabase.from("project_rooms").delete().eq("id", roomId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
