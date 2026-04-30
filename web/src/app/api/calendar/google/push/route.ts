import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

type PushEvent = {
  date: string;
  tradeName: string;
  projectName: string;
  duration?: string;
  notes?: string;
  roomName?: string;
  location?: string;
};

type PushBody = {
  projectId?: string;
  pushToMyCalendar?: boolean;
  attendees?: string[];
  events?: PushEvent[];
};

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: PushBody;
  try {
    body = (await request.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  if (!events.length) {
    return NextResponse.json({ error: "No events to push." }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Google Calendar OAuth is not configured on the server." }, { status: 503 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("google_calendar_refresh_token")
    .eq("id", auth.uid)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const refresh = (prof as { google_calendar_refresh_token?: string } | null)?.google_calendar_refresh_token;
  if (!refresh) {
    return NextResponse.json(
      { error: "Connect Google Calendar first using the Connect link in RenoFlow." },
      { status: 400 },
    );
  }

  const wantsMyCal = body.pushToMyCalendar !== false;
  const attendeesRaw = Array.isArray(body.attendees) ? body.attendees : [];
  if (!wantsMyCal && attendeesRaw.length === 0) {
    return NextResponse.json(
      { error: "Enable My Calendar or at least one recipient for Google push." },
      { status: 400 },
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({ refresh_token: refresh });

  const cal = google.calendar({ version: "v3", auth: oauth2 });
  const attendees = attendeesRaw
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .map((email) => ({ email }));

  let created = 0;
  const errors: string[] = [];

  for (const ev of events) {
    const date = String(ev.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const trade = String(ev.tradeName ?? "Trade").trim() || "Trade";
    const proj = String(ev.projectName ?? "Project").trim() || "Project";
    const dur = String(ev.duration ?? "full").toLowerCase();
    const durLabel = dur === "am" ? " (AM)" : dur === "pm" ? " (PM)" : "";
    const summary = `${trade} — ${proj}`;
    const descParts = [
      ev.notes?.trim() ? ev.notes.trim() : "",
      ev.roomName ? `Room: ${ev.roomName}` : "",
      dur !== "full" ? `When: ${dur.toUpperCase()}` : "",
    ].filter(Boolean);
    const endDate = addDaysYmd(date, 1);

    try {
      await cal.events.insert({
        calendarId: "primary",
        sendUpdates: attendees.length ? "all" : "none",
        requestBody: {
          summary: summary + durLabel,
          description: descParts.join("\n\n") || undefined,
          location: ev.location?.trim() || undefined,
          start: { date },
          end: { date: endDate },
          attendees: attendees.length ? attendees : undefined,
          guestsCanModify: false,
          guestsCanInviteOthers: false,
        },
      });
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    errors: errors.length ? errors : undefined,
  });
}
