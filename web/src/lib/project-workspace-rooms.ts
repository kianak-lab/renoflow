import type { SupabaseClient } from "@supabase/supabase-js";
import { unpackDemolitionNote } from "@/lib/demolition-workspace";
import { TB, TN, type CatalogItem } from "@/lib/final-catalog";

function cloneItems(slug: string): Array<CatalogItem & { qty: number; wasAuto: boolean }> {
  const rows = TB[slug] ?? TB.demo;
  return rows.map((it) => ({
    ...it,
    qty: 0,
    wasAuto: false,
  }));
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

function bool(row: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "boolean") return v;
  }
  return false;
}

function tradeIdToSlug(tradeId: unknown): string {
  const s = String(tradeId ?? "demo").trim().toLowerCase();
  if (s && TN[s]) return s;
  if (s && TB[s]) return s;
  return "demo";
}

/** Builds `final.html`-shaped `rooms[]` from Supabase `project_rooms` / `project_room_trades` / `project_trade_items`. */
export async function fetchRoomsForFinalApp(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data: roomRows, error: roomErr } = await supabase
    .from("project_rooms")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (roomErr) throw new Error(`project_rooms: ${roomErr.message}`);
  const rooms = (roomRows ?? []) as Record<string, unknown>[];
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => String(r.id));
  const { data: rtRows, error: rtErr } = await supabase
    .from("project_room_trades")
    .select("*")
    .in("room_id", roomIds)
    .order("sort_order", { ascending: true });
  if (rtErr) throw new Error(`project_room_trades: ${rtErr.message}`);
  const roomTrades = (rtRows ?? []) as Record<string, unknown>[];

  const rtIds = roomTrades.map((r) => String(r.id)).filter(Boolean);
  let items: Record<string, unknown>[] = [];
  if (rtIds.length > 0) {
    const { data: itemRows, error: itErr } = await supabase
      .from("project_trade_items")
      .select("*")
      .in("room_trade_id", rtIds)
      .order("sort_order", { ascending: true });
    if (itErr) throw new Error(`project_trade_items: ${itErr.message}`);
    items = (itemRows ?? []) as Record<string, unknown>[];
  }

  const itemsByRt = new Map<string, Record<string, unknown>[]>();
  for (const it of items) {
    const rid = String(it.room_trade_id ?? "");
    if (!rid) continue;
    const list = itemsByRt.get(rid) ?? [];
    list.push(it);
    itemsByRt.set(rid, list);
  }

  const rtByRoom = new Map<string, Record<string, unknown>[]>();
  for (const rt of roomTrades) {
    const rid = String(rt.room_id ?? "");
    if (!rid) continue;
    const list = rtByRoom.get(rid) ?? [];
    list.push(rt);
    rtByRoom.set(rid, list);
  }

  const appRooms: Array<Record<string, unknown>> = [];

  for (const room of rooms) {
    const roomId = String(room.id ?? "");
    const name = String(room.name ?? "Room");
    const icon = (room.icon as string) ?? "🏠";
    const dimensions =
      room.dimensions && typeof room.dimensions === "object"
        ? (room.dimensions as Record<string, unknown>)
        : {};

    const rts = (rtByRoom.get(roomId) ?? []).slice().sort((a, b) => {
      return num(a, ["sort_order"]) - num(b, ["sort_order"]);
    });

    const trades: Array<Record<string, unknown>> = [];
    for (const rt of rts) {
      const slug = tradeIdToSlug(rt.trade_id);
      const itemsForRt = itemsByRt.get(String(rt.id ?? "")) ?? [];

      const tradeItems = cloneItems(slug);
      for (const dbIt of itemsForRt) {
        const code = String(dbIt.code ?? "");
        const match = tradeItems.find((x) => x.id === code);
        if (match) {
          match.qty = num(dbIt, ["quantity", "qty"]);
          match.p = num(dbIt, ["unit_price", "p", "price"]);
          match.wasAuto = bool(dbIt, ["was_auto", "wasAuto"]);
        } else if (slug === "demo" && code) {
          tradeItems.push({
            id: code,
            l: String(dbIt.label ?? "Material"),
            u: String(dbIt.unit ?? "ea"),
            p: num(dbIt, ["unit_price", "p", "price"]),
            qty: num(dbIt, ["quantity", "qty"]),
            wasAuto: bool(dbIt, ["was_auto", "wasAuto"]),
          });
        }
      }

      const rawNote = String(rt.note ?? rt.notes ?? "");
      const demoUnpack = slug === "demo" ? unpackDemolitionNote(rawNote) : null;
      const noteOut = demoUnpack ? "" : rawNote;

      trades.push({
        id: slug,
        n: TN[slug] ?? slug,
        open: bool(rt, ["is_open", "isOpen"]),
        note: noteOut,
        fx: {},
        days: num(rt, ["days"]),
        daysCustom: bool(rt, ["days_custom", "daysCustom"]),
        items: tradeItems,
        ...(demoUnpack
          ? {
              rfDemolition: demoUnpack,
              materialsBillToClient: demoUnpack.materialsBillToClient !== false,
            }
          : {}),
      });
    }

    appRooms.push({
      n: name,
      ic: icon,
      trades,
      d: dimensions,
      dbRoomId: roomId,
    });
  }

  return appRooms;
}
