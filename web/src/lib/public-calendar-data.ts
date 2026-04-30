import { createServiceClient } from "@/lib/supabase-service";
import { TN } from "@/lib/final-catalog";
import { fetchRoomsForFinalApp } from "@/lib/project-workspace-rooms";

export type PublicCalendarEvent = {
  date: string;
  duration: string;
  tradeId: string;
  tradeName: string;
  roomName: string;
  notes: string;
};

export type PublicCalendarPayload = {
  projectName: string;
  address: string;
  companyName: string;
  companyPhone: string;
  slug: string;
  events: PublicCalendarEvent[];
};

export async function loadPublicCalendarBySlug(
  rawSlug: string,
): Promise<PublicCalendarPayload | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,120}$/.test(slug)) return null;

  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("id,name,address,user_id,calendar_slug")
    .eq("calendar_slug", slug)
    .maybeSingle();

  if (pErr || !proj) return null;

  const row = proj as Record<string, unknown>;
  const projectId = String(row.id ?? "");
  const uid = String(row.user_id ?? "");

  const { data: prof } = await supabase
    .from("profiles")
    .select("company_name,company_phone")
    .eq("id", uid)
    .maybeSingle();
  const pr = (prof ?? {}) as Record<string, unknown>;

  let rooms: Array<Record<string, unknown>> = [];
  try {
    rooms = (await fetchRoomsForFinalApp(supabase, projectId)) as Array<Record<string, unknown>>;
  } catch {
    rooms = [];
  }

  const events: PublicCalendarEvent[] = [];
  for (const room of rooms) {
    const roomName = String(room.n ?? "Room");
    const trades = (room.trades ?? []) as Array<Record<string, unknown>>;
    for (const t of trades) {
      const tradeSlug = String(t.id ?? "");
      const tradeName = String(t.n ?? TN[tradeSlug] ?? tradeSlug);
      const slots = t.calendarSlots;
      if (!Array.isArray(slots)) continue;
      for (const sl of slots) {
        if (!sl || typeof sl !== "object") continue;
        const o = sl as Record<string, unknown>;
        const date = String(o.date ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        let duration = String(o.duration ?? "full").toLowerCase();
        if (duration !== "am" && duration !== "pm") duration = "full";
        events.push({
          date,
          duration,
          tradeId: tradeSlug,
          tradeName,
          roomName,
          notes: String(o.notes ?? ""),
        });
      }
    }
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.roomName.localeCompare(b.roomName) ||
      a.tradeName.localeCompare(b.tradeName),
  );

  return {
    slug,
    projectName: String(row.name ?? "Project"),
    address: String(row.address ?? "").trim(),
    companyName: String(pr.company_name ?? "Contractor").trim() || "Contractor",
    companyPhone: String(pr.company_phone ?? "").trim(),
    events,
  };
}
