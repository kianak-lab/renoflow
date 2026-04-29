import { NextResponse } from "next/server";
import { TN } from "@/lib/final-catalog";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; roomId: string }> };

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

  const { id: projectId, roomId } = await context.params;
  if (!projectId || !roomId) {
    return NextResponse.json({ error: "Missing project or room id." }, { status: 400 });
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

  const { data: roomRow, error: roomErr } = await supabase
    .from("project_rooms")
    .select("*")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });
  if (!roomRow) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const room = roomRow as Record<string, unknown>;
  const dimsRaw =
    room.dimensions && typeof room.dimensions === "object"
      ? (room.dimensions as Record<string, unknown>)
      : {};

  const lengthFt = num(dimsRaw, ["L", "l", "length"], 0);
  const widthFt = num(dimsRaw, ["W", "w", "width"], 0);
  const heightFt = num(dimsRaw, ["H", "h", "height"], 0);
  const floorSq = num(dimsRaw, ["floorArea", "floor_area"], 0);

  const { data: rtRows, error: rtErr } = await supabase
    .from("project_room_trades")
    .select("*")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true });

  if (rtErr) return NextResponse.json({ error: rtErr.message }, { status: 500 });
  const tradesRaw = (rtRows ?? []) as Record<string, unknown>[];

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

  const trades = tradesRaw.map((rt) => {
    const rtid = String(rt.id ?? "");
    const slug = str(rt, ["trade_id"], "").trim().toLowerCase();
    const est = Math.round((itemsSumByRt.get(rtid) ?? 0) * 100) / 100;
    const isOpen = rt.is_open === true;
    const days = Math.round(num(rt, ["days"], 0));
    const estimatedTotal = est;
    let status: "complete" | "in_progress" | "pending" = "pending";
    if (isOpen) status = "in_progress";
    else if (estimatedTotal > 0 || days > 0) status = "complete";
    else status = "pending";
    const categoryLabel =
      slug === "demo"
        ? "DEMOLITION"
        : (TN[slug] ?? slug.replace(/-/g, " ")).toUpperCase();

    return {
      id: rtid,
      trade_id: slug,
      name: tradeLabel(slug, str(rt, ["display_name"], "")),
      categoryLabel,
      note: str(rt, ["note"], ""),
      is_open: isOpen,
      days,
      estimated_total: estimatedTotal,
      status,
    };
  });

  const roomTotal = Math.round(trades.reduce((s, t) => s + t.estimated_total, 0) * 100) / 100;

  const dimsLineParts: string[] = [];
  if (lengthFt > 0 && widthFt > 0 && heightFt > 0) {
    dimsLineParts.push(`${lengthFt} × ${widthFt} × ${heightFt} ft`);
  } else if (lengthFt > 0 && widthFt > 0) {
    dimsLineParts.push(`${lengthFt} × ${widthFt} ft`);
  }
  if (floorSq > 0) {
    dimsLineParts.push(`${Math.round(floorSq)} sq ft`);
  }
  const dimensionsLine = dimsLineParts.length ? dimsLineParts.join(" · ") : "—";

  return NextResponse.json({
    project: {
      id: projectId,
      name: str(projRow, ["name"], "Project"),
      client_name: clientName,
      quote_number: str(projRow, ["quote_number"], "Q-001"),
    },
    room: {
      id: roomId,
      name: str(room, ["name"], "Room"),
      dimensions: {
        length_ft: lengthFt,
        width_ft: widthFt,
        height_ft: heightFt,
        floor_sq_ft: floorSq,
      },
      dimensions_line: dimensionsLine,
      estimated_total: roomTotal,
    },
    trades,
    room_total: roomTotal,
  });
}
