import type { SupabaseClient } from "@supabase/supabase-js";
import { unpackDemolitionNote } from "@/lib/demolition-workspace";
import { TB, TN, normalizeTradeSlug, type CatalogItem } from "@/lib/final-catalog";

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
  const s = normalizeTradeSlug(String(tradeId ?? "demo"));
  if (s && TN[s]) return s;
  if (s && TB[s]) return s;
  return "demo";
}

/** `final.html` quote math uses `trade.catPick`; rebuild from demolition note + DB material lines. */
function buildDemoCatPickFromUnpack(
  demoUnpack: NonNullable<ReturnType<typeof unpackDemolitionNote>>,
  tradeItems: Array<{ id?: string; l?: string; p?: number }>,
): Record<
  string,
  { q: number; m: number; sup: number; title: string; brand: string; priceLabel: string; thumb: string }
> {
  const catPick: Record<
    string,
    { q: number; m: number; sup: number; title: string; brand: string; priceLabel: string; thumb: string }
  > = {};
  const mq = demoUnpack.materialQty ?? {};
  const markup = Math.max(0, Number(demoUnpack.clientMaterialsMarkupPct) || 0);
  for (const [pidRaw, qRaw] of Object.entries(mq)) {
    const pid = String(pidRaw);
    const qty = Math.max(0, Number(qRaw) || 0);
    if (qty <= 0) continue;
    const match = tradeItems.find((x) => String(x.id ?? "") === pid);
    const sup =
      typeof match?.p === "number" && !Number.isNaN(match.p) ? Math.max(0, match.p) : 0;
    catPick[pid] = {
      q: qty,
      m: markup,
      sup,
      title: typeof match?.l === "string" ? match.l : "—",
      brand: "",
      priceLabel: sup > 0 ? String(sup) : "—",
      thumb: "",
    };
  }
  return catPick;
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

      const rawCal = rt.calendar_slots;
      const calendarSlots: Array<{ date: string; duration: string; notes: string }> = [];
      if (Array.isArray(rawCal)) {
        for (const x of rawCal) {
          if (!x || typeof x !== "object") continue;
          const o = x as Record<string, unknown>;
          const date = String(o.date ?? "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          let duration = String(o.duration ?? "full").toLowerCase();
          if (duration !== "am" && duration !== "pm") duration = "full";
          calendarSlots.push({
            date,
            duration,
            notes: String(o.notes ?? "").slice(0, 4000),
          });
        }
      }

      trades.push({
        id: slug,
        n: TN[slug] ?? slug,
        open: bool(rt, ["is_open", "isOpen"]),
        note: noteOut,
        fx: {},
        days: num(rt, ["days"]),
        daysCustom: bool(rt, ["days_custom", "daysCustom"]),
        items: tradeItems,
        calendarSlots,
        ...(demoUnpack
          ? {
              rfDemolition: demoUnpack,
              materialsBillToClient: demoUnpack.materialsBillToClient !== false,
              catPick: buildDemoCatPickFromUnpack(demoUnpack, tradeItems),
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
