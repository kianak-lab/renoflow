import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { fetchRoomsForFinalApp } from "@/lib/project-workspace-rooms";
import { TN } from "@/lib/final-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(_req: Request, context: Ctx) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select(
      "id,name,address,start_date,client_id,calendar_slug,calendar_recipients,calendar_my_google_enabled,user_id",
    )
    .eq("id", projectId)
    .eq("user_id", auth.uid)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proj) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const p = proj as Record<string, unknown>;

  const { data: prof } = await supabase
    .from("profiles")
    .select("company_name,company_phone,google_calendar_email")
    .eq("id", auth.uid)
    .maybeSingle();
  const pr = (prof ?? {}) as Record<string, unknown>;

  let client: { full_name: string; email: string | null; phone: string | null } | null = null;
  const cid = typeof p.client_id === "string" ? p.client_id : null;
  if (cid) {
    const { data: cl } = await supabase
      .from("clients")
      .select("full_name,email,phone")
      .eq("id", cid)
      .eq("user_id", auth.uid)
      .maybeSingle();
    if (cl && typeof cl === "object") {
      const c = cl as Record<string, unknown>;
      client = {
        full_name: String(c.full_name ?? "Client"),
        email: typeof c.email === "string" ? c.email : null,
        phone: typeof c.phone === "string" ? c.phone : null,
      };
    }
  }

  const roomRows = await fetchRoomsForFinalApp(supabase, projectId);

  const roomIds = roomRows.map((r) => String(r.dbRoomId ?? "")).filter(Boolean);
  const rtKeyToId = new Map<string, string>();
  if (roomIds.length > 0) {
    const { data: rtList, error: rtlErr } = await supabase
      .from("project_room_trades")
      .select("id,room_id,trade_id")
      .in("room_id", roomIds);
    if (rtlErr) return NextResponse.json({ error: rtlErr.message }, { status: 500 });
    for (const row of rtList ?? []) {
      const o = row as { id: string; room_id: string; trade_id: string };
      rtKeyToId.set(`${o.room_id}|${o.trade_id}`, o.id);
    }
  }

  const roomsOut = [];
  let roomsCount = 0;
  let sumPlanDays = 0;

  for (const room of roomRows) {
    const rid = String(room.dbRoomId ?? "");
    if (!rid) continue;
    roomsCount++;
    const tradesRaw = (room.trades ?? []) as Array<Record<string, unknown>>;
    const trades = [];
    for (const t of tradesRaw) {
      const slug = String(t.id ?? "demo");
      const days = Math.max(0, num(t, ["days"]));
      sumPlanDays += days;
      const calendarSlots = (t.calendarSlots as Array<{ date: string; duration: string; notes: string }>) ?? [];

      const roomTradeId = rtKeyToId.get(`${rid}|${slug}`) ?? "";

      trades.push({
        roomTradeId,
        tradeId: slug,
        tradeName: String(t.n ?? TN[slug] ?? slug),
        days,
        calendarSlots,
      });
    }
    roomsOut.push({
      id: rid,
      name: String(room.n ?? "Room"),
      icon: String(room.ic ?? "🏠"),
      trades,
    });
  }

  return NextResponse.json({
    project: {
      id: projectId,
      name: String(p.name ?? "Project"),
      address: String(p.address ?? "").trim(),
      startDate: p.start_date ? String(p.start_date).slice(0, 10) : "",
      clientId: cid,
      calendarSlug: String(p.calendar_slug ?? "").trim(),
      calendarRecipients: p.calendar_recipients ?? [],
      calendarMyGoogleEnabled: p.calendar_my_google_enabled === true,
    },
    profile: {
      companyName: String(pr.company_name ?? "").trim(),
      companyPhone: String(pr.company_phone ?? "").trim(),
      googleCalendarEmail: String(pr.google_calendar_email ?? "").trim(),
    },
    client,
    rooms: roomsOut,
    stats: {
      roomsCount,
      planDaysSum: sumPlanDays,
    },
  });
}
