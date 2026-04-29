import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { TN } from "@/lib/final-catalog";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function str(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return fallback;
}

function num(row: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

function tradeLabel(tradeId: string, displayName: string): string {
  const slug = String(tradeId ?? "").trim().toLowerCase();
  if (displayName.trim()) return displayName.trim();
  return TN[slug] ?? slug;
}

function formatDims(d: Record<string, unknown> | null | undefined): string {
  if (!d || typeof d !== "object") return "—";
  const floor = Number((d as { floorArea?: unknown }).floorArea);
  if (!Number.isNaN(floor) && floor > 0) return `${floor} sf`;
  const L = (d as { L?: unknown; l?: unknown; length?: unknown }).L ??
    (d as { l?: unknown }).l ??
    (d as { length?: unknown }).length;
  const W = (d as { W?: unknown; w?: unknown; width?: unknown }).W ??
    (d as { w?: unknown }).w ??
    (d as { width?: unknown }).width;
  const ls = L != null && String(L).trim() !== "" ? String(L) : "";
  const ws = W != null && String(W).trim() !== "" ? String(W) : "";
  if (ls && ws) return `${ls}×${ws} ft`;
  return "—";
}

export async function GET(_request: Request, context: RouteCtx) {
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
    .select("*")
    .eq("id", projectId)
    .eq("user_id", auth.uid)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proj) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const projRow = proj as Record<string, unknown>;
  let clientName = str(projRow, ["client_name"], "");
  const cid = typeof projRow.client_id === "string" ? projRow.client_id : null;
  if (cid) {
    const { data: cl } = await supabase
      .from("clients")
      .select("full_name")
      .eq("id", cid)
      .eq("user_id", auth.uid)
      .maybeSingle();
    if (cl && typeof cl === "object" && "full_name" in cl && typeof (cl as { full_name: string }).full_name === "string") {
      clientName = (cl as { full_name: string }).full_name || clientName;
    }
  }

  let invoices: Record<string, unknown>[] = [];
  try {
    const invRes = await supabase.from("invoices").select("*").eq("project_id", projectId);
    if (!invRes.error) invoices = (invRes.data ?? []) as Record<string, unknown>[];
  } catch {
    invoices = [];
  }

  let totalValue = 0;
  let outstanding = 0;
  for (const row of invoices) {
    const r = row as Record<string, unknown>;
    if (r.void === true) continue;
    const t = num(r, ["total_amount", "total"], 0);
    totalValue += t;
    if (r.paid !== true) outstanding += t;
  }

  const { data: roomRows, error: roomErr } = await supabase
    .from("project_rooms")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });

  const roomsRaw = (roomRows ?? []) as Record<string, unknown>[];
  const roomIds = roomsRaw.map((r) => String(r.id));

  let tradesRaw: Record<string, unknown>[] = [];
  if (roomIds.length > 0) {
    const { data: tr, error: trErr } = await supabase
      .from("project_room_trades")
      .select("*")
      .in("room_id", roomIds)
      .order("sort_order", { ascending: true });
    if (trErr) return NextResponse.json({ error: trErr.message }, { status: 500 });
    tradesRaw = (tr ?? []) as Record<string, unknown>[];
  }

  const rtIds = tradesRaw.map((t) => String(t.id)).filter(Boolean);

  const itemsSumByRt = new Map<string, number>();
  if (rtIds.length > 0) {
    const { data: items } = await supabase
      .from("project_trade_items")
      .select("room_trade_id, quantity, unit_price")
      .in("room_trade_id", rtIds);
    for (const it of items ?? []) {
      const row = it as Record<string, unknown>;
      const rid = String(row.room_trade_id ?? "");
      const q = num(row, ["quantity", "qty"], 0);
      const p = num(row, ["unit_price", "p"], 0);
      itemsSumByRt.set(rid, (itemsSumByRt.get(rid) ?? 0) + q * p);
    }

    const { data: fixRows } = await supabase
      .from("project_trade_fixtures")
      .select("room_trade_id, quantity, unit_price")
      .in("room_trade_id", rtIds);
    for (const it of fixRows ?? []) {
      const row = it as Record<string, unknown>;
      const rid = String(row.room_trade_id ?? "");
      const q = num(row, ["quantity", "qty"], 0);
      const p = num(row, ["unit_price", "p"], 0);
      itemsSumByRt.set(rid, (itemsSumByRt.get(rid) ?? 0) + q * p);
    }
  }

  const tradesByRoom = new Map<string, Record<string, unknown>[]>();
  for (const rt of tradesRaw) {
    const rid = String(rt.room_id ?? "");
    if (!rid) continue;
    const list = tradesByRoom.get(rid) ?? [];
    list.push(rt);
    tradesByRoom.set(rid, list);
  }

  const startDate = str(projRow, ["start_date"], "");
  let daysActive = 0;
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const [y, m, d] = startDate.split("-").map((x) => parseInt(x, 10));
    const start = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    daysActive = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
  } else {
    const created = projRow.created_at;
    if (typeof created === "string") {
      const t = Date.parse(created);
      if (!Number.isNaN(t)) {
        daysActive = Math.max(
          0,
          Math.floor((Date.now() - t) / 86400000),
        );
      }
    }
  }

  const rooms = roomsRaw.map((room) => {
    const roomId = String(room.id ?? "");
    const rts = tradesByRoom.get(roomId) ?? [];
    let est = 0;
    const chips = rts.map((rt) => {
      const rtid = String(rt.id ?? "");
      est += itemsSumByRt.get(rtid) ?? 0;
      const tid = str(rt, ["trade_id"], "");
      const dn = str(rt, ["display_name"], "");
      return {
        trade_id: tid,
        label: tradeLabel(tid, dn),
      };
    });

    const dims = room.dimensions && typeof room.dimensions === "object"
      ? (room.dimensions as Record<string, unknown>)
      : {};

    return {
      id: roomId,
      name: str(room, ["name"], "Room"),
      icon: str(room, ["icon"], ""),
      dimensions: dims,
      dimensionsLabel: formatDims(dims),
      estimatedTotal: Math.round(est * 100) / 100,
      trades: chips,
    };
  });

  return NextResponse.json({
    project: {
      id: projectId,
      name: str(projRow, ["name"], "Project"),
      client_name: clientName,
      address: str(projRow, ["address"], ""),
      quote_number: str(projRow, ["quote_number"], "Q-001"),
      start_date: startDate,
    },
    stats: {
      projectValue: Math.round(totalValue * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      roomsCount: rooms.length,
      daysActive,
    },
    rooms,
  });
}
