"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tradeScheduleBg } from "@/lib/schedule-trade-colors";

type CalendarSlot = { date: string; duration: string; notes: string };

type ScheduleTrade = {
  roomTradeId: string;
  tradeId: string;
  tradeName: string;
  days: number;
  calendarSlots: CalendarSlot[];
  roomId: string;
  roomName: string;
};

type SchedulePayload = {
  project: {
    id: string;
    name: string;
    address: string;
    startDate: string;
    clientId: string | null;
    calendarSlug: string;
    calendarRecipients: unknown;
    calendarMyGoogleEnabled: boolean;
  };
  profile: { companyName: string; companyPhone: string; googleCalendarEmail: string };
  client: { full_name: string; email: string | null; phone: string | null } | null;
  rooms: Array<{
    id: string;
    name: string;
    icon: string;
    trades: Array<{
      roomTradeId: string;
      tradeId: string;
      tradeName: string;
      days: number;
      calendarSlots: CalendarSlot[];
    }>;
  }>;
  stats: { roomsCount: number; planDaysSum: number };
};

const mono = { fontFamily: "var(--rf-plex-mono), ui-monospace, monospace" } as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(s: string): Date | null {
  const p = s.split("-").map(Number);
  if (p.length !== 3 || p.some((x) => Number.isNaN(x))) return null;
  return new Date(p[0]!, p[1]! - 1, p[2]!);
}

function fmtRange(d0: Date, d1: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d0.getFullYear() !== d1.getFullYear()) {
    return `${d0.toLocaleDateString("en-US", { ...opts, year: "numeric" })} – ${d1.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }
  return `${d0.toLocaleDateString("en-US", opts)} – ${d1.toLocaleDateString("en-US", opts)}`;
}

function mondayOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekRangeContaining(d: Date) {
  const mon = mondayOfWeek(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}

function flattenTrades(payload: SchedulePayload): ScheduleTrade[] {
  const out: ScheduleTrade[] = [];
  for (const room of payload.rooms) {
    for (const t of room.trades) {
      if (!t.days && !(t.calendarSlots?.length ?? 0)) continue;
      out.push({
        ...t,
        roomId: room.id,
        roomName: room.name,
      });
    }
  }
  return out;
}

function slotOnDay(slots: CalendarSlot[], ymdStr: string) {
  return slots.find((s) => s.date === ymdStr) ?? null;
}

function tradesOnDay(trades: ScheduleTrade[], ymdStr: string): string[] {
  const ids: string[] = [];
  for (const t of trades) {
    if (t.calendarSlots.some((s) => s.date === ymdStr) && ids.indexOf(t.tradeId) < 0) {
      ids.push(t.tradeId);
    }
  }
  return ids;
}

function cellBackground(tradeIds: string[]): string {
  if (!tradeIds.length) return "transparent";
  if (tradeIds.length === 1) return tradeScheduleBg(tradeIds[0]!);
  const a = tradeScheduleBg(tradeIds[0]!);
  const b = tradeScheduleBg(tradeIds[1]!);
  return `linear-gradient(135deg,${a} 0%,${a} 50%,${b} 50%,${b} 100%)`;
}

function monthMatrix(view: Date) {
  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  const last = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= last; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Recipient = { name: string; email: string; role: string; enabled: boolean };

function normalizeRecipients(raw: unknown): Recipient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const email = String(o.email ?? "").trim().toLowerCase();
      if (!email) return null;
      return {
        name: String(o.name ?? "").trim() || "Guest",
        email,
        role: String(o.role ?? "Sub").trim() || "Sub",
        enabled: o.enabled !== false,
      };
    })
    .filter(Boolean) as Recipient[];
}

export default function ScheduleClient({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<SchedulePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"timeline" | "calendar">("timeline");
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [googleSt, setGoogleSt] = useState<{
    connected: boolean;
    email: string | null;
    oauthConfigured: boolean;
  } | null>(null);
  const [shareSlug, setShareSlug] = useState("");
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/schedule`, {
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<SchedulePayload>;
      if (!res.ok) {
        setError(j.error ?? "Could not load schedule.");
        setPayload(null);
        return;
      }
      setPayload(j as SchedulePayload);
    } catch {
      setError("Network error.");
      setPayload(null);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const trades = useMemo(() => (payload ? flattenTrades(payload) : []), [payload]);

  const allSlotDates = useMemo(() => {
    const o: Record<string, boolean> = {};
    for (const t of trades) {
      for (const s of t.calendarSlots) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(s.date)) o[s.date] = true;
      }
    }
    return Object.keys(o).sort();
  }, [trades]);

  const overview = useMemo(() => {
    const roomsCount = payload?.stats.roomsCount ?? 0;
    const planSum = payload?.stats.planDaysSum ?? 0;
    const startFromProj = payload?.project.startDate?.trim() ?? "";
    let start = startFromProj;
    let end = "";
    if (allSlotDates.length) {
      if (!start) start = allSlotDates[0]!;
      end = allSlotDates[allSlotDates.length - 1]!;
    }
    return {
      start: start || "—",
      end: end || "—",
      totalDays: allSlotDates.length || planSum,
      roomsCount,
    };
  }, [payload, allSlotDates]);

  const unassignedCount = useMemo(() => {
    let n = 0;
    for (const t of trades) {
      const need = Math.max(0, t.days);
      const have = t.calendarSlots.length;
      n += Math.max(0, need - have);
    }
    return n;
  }, [trades]);

  const legendIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) s.add(t.tradeId);
    return [...s];
  }, [trades]);

  const today = useMemo(() => new Date(), []);
  const todayYmd = ymd(today);
  const { mon: thisMon, sun: thisSun } = weekRangeContaining(today);
  const showThisWeekBanner = useMemo(() => {
    return allSlotDates.some((d) => {
      const x = parseYmd(d);
      if (!x) return false;
      return x >= thisMon && x <= thisSun;
    });
  }, [allSlotDates, thisMon, thisSun]);

  const timelineWeeks = useMemo(() => {
    const assigned = trades.filter((t) => t.calendarSlots.length > 0);
    const unassigned = trades.filter((t) => t.calendarSlots.length === 0 && t.days > 0);
    type Card = ScheduleTrade & {
      minD: Date | null;
      maxD: Date | null;
      prog: number;
      status: "complete" | "active" | "pending";
    };
    const cards: Card[] = [];
    for (const t of assigned) {
      const dates = t.calendarSlots.map((s) => parseYmd(s.date)).filter(Boolean) as Date[];
      dates.sort((a, b) => a.getTime() - b.getTime());
      const minD = dates[0] ?? null;
      const maxD = dates[dates.length - 1] ?? null;
      const need = Math.max(1, t.days);
      const pct = Math.min(100, Math.round((100 * t.calendarSlots.length) / need));
      let status: Card["status"] = "pending";
      if (pct >= 100) status = "complete";
      else if (pct > 0) status = "active";
      cards.push({ ...t, minD, maxD, prog: pct, status });
    }
    cards.sort((a, b) => (a.minD?.getTime() ?? 0) - (b.minD?.getTime() ?? 0));
    const sections: { label: string; items: Card[] }[] = [];
    let weekNum = 0;
    let lastKey = "";
    for (const c of cards) {
      if (!c.minD) continue;
      const mon = mondayOfWeek(c.minD);
      const key = ymd(mon);
      if (key !== lastKey) {
        weekNum++;
        lastKey = key;
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        sections.push({
          label: `WEEK ${weekNum} — ${fmtRange(mon, sun)}`.toUpperCase(),
          items: [],
        });
      }
      sections[sections.length - 1]!.items.push(c);
    }
    return { sections, unassigned };
  }, [trades]);

  const patchSlots = async (roomTradeId: string, slots: CalendarSlot[]) => {
    if (!roomTradeId) return;
    const res = await fetch(`/api/project-room-trades/${encodeURIComponent(roomTradeId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ calendar_slots: slots }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(j.error ?? "Save failed");
    await load();
  };

  const updateSlotField = async (
    t: ScheduleTrade,
    ymdStr: string,
    patch: Partial<CalendarSlot>,
  ) => {
    const slots = t.calendarSlots.map((s) => ({ ...s }));
    const i = slots.findIndex((s) => s.date === ymdStr);
    if (i < 0) return;
    slots[i] = { ...slots[i]!, ...patch };
    await patchSlots(t.roomTradeId, slots);
  };

  const setDaySlot = async (t: ScheduleTrade, ymdStr: string, duration: string, notes: string) => {
    const slots = [...t.calendarSlots];
    const i = slots.findIndex((s) => s.date === ymdStr);
    if (i >= 0) slots[i] = { date: ymdStr, duration, notes };
    else slots.push({ date: ymdStr, duration, notes });
    slots.sort((a, b) => a.date.localeCompare(b.date));
    await patchSlots(t.roomTradeId, slots);
  };

  const removeDayForTrade = async (t: ScheduleTrade, ymdStr: string) => {
    await patchSlots(
      t.roomTradeId,
      t.calendarSlots.filter((s) => s.date !== ymdStr),
    );
  };

  const clearWholeDay = async (ymdStr: string) => {
    for (const t of trades) {
      if (t.calendarSlots.some((s) => s.date === ymdStr)) {
        await patchSlots(
          t.roomTradeId,
          t.calendarSlots.filter((s) => s.date !== ymdStr),
        );
      }
    }
  };

  const openPush = async () => {
    setPushOpen(true);
    try {
      const st = await fetch("/api/calendar/google/status", { credentials: "include" }).then((r) => r.json());
      setGoogleSt({
        connected: !!st.connected,
        email: typeof st.email === "string" ? st.email : null,
        oauthConfigured: !!st.oauthConfigured,
      });
    } catch {
      setGoogleSt(null);
    }
    const slugRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ensure-calendar-slug`, {
      method: "POST",
      credentials: "include",
    }).then((r) => r.json());
    if (slugRes.slug) setShareSlug(String(slugRes.slug));
  };

  const recipients = useMemo(() => {
    const base = normalizeRecipients(payload?.project.calendarRecipients);
    return base;
  }, [payload]);

  const pushEvents = useMemo(() => {
    const ev: Array<{
      date: string;
      tradeName: string;
      projectName: string;
      duration: string;
      notes: string;
      roomName: string;
      location: string;
    }> = [];
    const projName = payload?.project.name ?? "Project";
    const addr = payload?.project.address ?? "";
    for (const t of trades) {
      for (const s of t.calendarSlots) {
        ev.push({
          date: s.date,
          tradeName: t.tradeName,
          projectName: projName,
          duration: s.duration,
          notes: s.notes,
          roomName: t.roomName,
          location: addr,
        });
      }
    }
    return ev;
  }, [trades, payload]);

  const patchProjectCalendar = async (body: Record<string, unknown>) => {
    await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    await load();
  };

  const runPushAll = async (attendeeEmails: string[]) => {
    if (!pushEvents.length) {
      alert("Assign days on the calendar first.");
      return;
    }
    setPushBusy(true);
    try {
      const res = await fetch("/api/calendar/google/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          events: pushEvents,
          pushToMyCalendar: payload?.project.calendarMyGoogleEnabled === true,
          attendees: attendeeEmails,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; created?: number };
      if (!res.ok) {
        alert(j.error ?? "Push failed");
        return;
      }
      alert(`Created ${j.created ?? 0} calendar event(s).`);
    } finally {
      setPushBusy(false);
    }
  };

  if (error || !payload) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 py-8">
        <p className="text-sm text-[#888]">{error ?? "Loading…"}</p>
        {error ? (
          <button type="button" className="mt-4 text-sm font-semibold text-[#0f2318]" onClick={() => void load()}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const cells = monthMatrix(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const selectedTradesForPanel = selectedYmd
    ? trades.filter((t) => t.days > 0)
    : [];

  const publicBase = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = shareSlug ? `${publicBase}/cal/${encodeURIComponent(shareSlug)}` : "";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header
        className="shrink-0 px-4 pb-4 pt-[env(safe-area-inset-top,0px)]"
        style={{ background: "#0f2318" }}
      >
        <div className="flex items-start gap-3">
          <Link
            href={`/project/${encodeURIComponent(projectId)}`}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
            aria-label="Back"
          >
            <span className="text-xl leading-none">←</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              PROJECT SCHEDULE
            </p>
            <h1 className="mt-1 text-[22px] font-medium leading-tight text-white">{payload.project.name}</h1>
            <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.5)", ...mono }}>
              {overview.totalDays} days · {overview.roomsCount} rooms
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/project/${encodeURIComponent(projectId)}`}
                className="inline-flex items-center rounded-[100px] bg-white px-3 py-2 text-[12px] font-semibold text-[#0f2318] no-underline"
              >
                Export PDF
              </Link>
              <button
                type="button"
                className="rounded-[100px] border-[0.5px] border-white/40 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white"
                onClick={() => void openPush()}
              >
                Share
              </button>
              <button
                type="button"
                className="rounded-[100px] border-[0.5px] border-white/40 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white"
                onClick={() => void openPush()}
              >
                Push Calendar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 gap-8 border-b-[0.5px] border-[#e0e0e0] bg-white px-4">
        <button
          type="button"
          className="pb-3 pt-2 text-[14px]"
          style={{
            fontWeight: tab === "timeline" ? 500 : 400,
            color: tab === "timeline" ? "#111" : "#aaa",
            borderBottom: tab === "timeline" ? "2px solid #0f2318" : "2px solid transparent",
            marginBottom: "-1px",
          }}
          onClick={() => setTab("timeline")}
        >
          Timeline
        </button>
        <button
          type="button"
          className="pb-3 pt-2 text-[14px]"
          style={{
            fontWeight: tab === "calendar" ? 500 : 400,
            color: tab === "calendar" ? "#111" : "#aaa",
            borderBottom: tab === "calendar" ? "2px solid #0f2318" : "2px solid transparent",
            marginBottom: "-1px",
          }}
          onClick={() => setTab("calendar")}
        >
          Calendar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa] px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom,24px))]">
        {tab === "timeline" ? (
          <>
            <div
              className="grid grid-cols-2 gap-0 overflow-hidden rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white"
              style={{ marginBottom: 16 }}
            >
              {[
                ["START DATE", overview.start],
                ["END DATE", overview.end],
                ["TOTAL DAYS", String(overview.totalDays)],
                ["ROOMS", String(overview.roomsCount)],
              ].map(([lab, val]) => (
                <div key={lab} className="border-[0.5px] border-[#e0e0e0] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">{lab}</div>
                  <div className="mt-1 text-[15px] text-[#111]" style={mono}>
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {showThisWeekBanner ? (
              <div
                className="mb-4 rounded-[10px] border-[0.5px] border-[#c8e6c9] px-3 py-2 text-[13px] text-[#1b5e20]"
                style={{ background: "#f0faf2" }}
              >
                This week: {fmtRange(thisMon, thisSun)}
              </div>
            ) : null}

            {timelineWeeks.unassigned.length ? (
              <div className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">To schedule</p>
                {timelineWeeks.unassigned.map((t) => (
                  <TradeTimelineCard
                    key={`${t.roomTradeId}-u`}
                    t={t}
                    onAssign={() => {
                      setTab("calendar");
                    }}
                  />
                ))}
              </div>
            ) : null}

            {timelineWeeks.sections.map((sec) => (
              <div key={sec.label} className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">{sec.label}</p>
                {sec.items.map((t) => (
                  <TradeTimelineCard key={t.roomTradeId} t={t} onAssign={() => setTab("calendar")} />
                ))}
              </div>
            ))}

            <button
              type="button"
              className="mt-2 w-full rounded-[10px] py-4 text-[15px] font-semibold text-white"
              style={{ background: "#0f2318" }}
              onClick={() => void openPush()}
            >
              Push to Calendar
            </button>
          </>
        ) : (
          <>
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {legendIds.map((id) => {
                const name = trades.find((x) => x.tradeId === id)?.tradeName ?? id;
                return (
                  <div
                    key={id}
                    className="flex shrink-0 items-center gap-1.5 rounded-[100px] border-[0.5px] border-[#e0e0e0] bg-white px-2 py-1 text-[11px] text-[#555]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: tradeScheduleBg(id) }}
                      aria-hidden
                    />
                    {name}
                  </div>
                );
              })}
            </div>

            {unassignedCount > 0 ? (
              <div
                className="mb-3 rounded-[10px] border-[0.5px] border-[#ffe566] px-3 py-2 text-[13px] text-[#5c4a00]"
                style={{ background: "#fffbe6" }}
              >
                {unassignedCount} trade day{unassignedCount !== 1 ? "s" : ""} still unassigned on the calendar.
              </div>
            ) : null}

            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-lg text-[#111]"
                aria-label="Previous month"
                onClick={() =>
                  setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                }
              >
                ‹
              </button>
              <span className="text-[15px] font-medium text-[#111]">{monthLabel}</span>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-lg text-[#111]"
                aria-label="Next month"
                onClick={() =>
                  setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                }
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[#888]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, idx) => {
                if (!d) {
                  return <div key={`e-${idx}`} className="aspect-square" />;
                }
                const y = ymd(d);
                const tids = tradesOnDay(trades, y);
                const bg = cellBackground(tids);
                const isToday = y === todayYmd;
                return (
                  <button
                    key={y}
                    type="button"
                    className="relative flex aspect-square flex-col items-center justify-start rounded-[10px] border-[0.5px] border-[#e0e0e0] pt-1 text-[13px] outline-none"
                    style={{
                      background: isToday ? "#f0faf2" : bg === "transparent" ? "#fff" : bg,
                      color: isToday ? "#1b5e20" : "#111",
                    }}
                    onClick={() => setSelectedYmd(y)}
                  >
                    <span>{d.getDate()}</span>
                    {tids.length ? (
                      <span className="mt-auto mb-1 flex gap-0.5">
                        {tids.slice(0, 4).map((tid) => (
                          <span
                            key={tid}
                            className="h-1 w-1 rounded-full"
                            style={{ background: tid === tids[0] ? "#333" : "#666" }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedYmd ? (
              <DayDetailPanel
                ymdStr={selectedYmd}
                trades={selectedTradesForPanel}
                onClearDay={() => {
                  void clearWholeDay(selectedYmd);
                  setSelectedYmd(null);
                }}
                onClose={() => setSelectedYmd(null)}
                onUpdateSlot={updateSlotField}
                onSetDay={setDaySlot}
                onRemoveTradeDay={removeDayForTrade}
              />
            ) : null}

            <button
              type="button"
              className="mt-6 w-full rounded-[10px] py-4 text-[15px] font-semibold text-white"
              style={{ background: "#0f2318" }}
              onClick={() => void openPush()}
            >
              Push to Calendar
            </button>
          </>
        )}
      </div>

      {pushOpen ? (
        <div
          className="fixed inset-0 z-[30000] flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setPushOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[16px] bg-[#faf9f5] px-4 pb-[max(16px,env(safe-area-inset-bottom,16px))] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[#111]">Push &amp; share</h2>
              <button type="button" className="text-[22px] leading-none text-[#888]" onClick={() => setPushOpen(false)}>
                ×
              </button>
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#888]">My calendar</p>
            <div className="mb-4 rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white p-3 text-[14px]">
              <div className="font-semibold">My Google Calendar</div>
              <div className="mt-1 text-[12px] text-[#666]">
                {googleSt?.connected && googleSt.email ? googleSt.email : "Not connected"}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px]">Sync to my calendar</span>
                <button
                  type="button"
                  className={`relative h-[24px] w-[44px] rounded-full ${payload.project.calendarMyGoogleEnabled ? "bg-[#2d7a2d]" : "bg-[#ccc]"}`}
                  onClick={() =>
                    void patchProjectCalendar({
                      calendar_my_google_enabled: !payload.project.calendarMyGoogleEnabled,
                    })
                  }
                >
                  <span
                    className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                    style={{
                      transform: payload.project.calendarMyGoogleEnabled ? "translateX(20px)" : "none",
                    }}
                  />
                </button>
              </div>
              {googleSt?.oauthConfigured ? (
                <a
                  href="/api/calendar/google/start"
                  className="mt-2 inline-block text-[13px] font-semibold text-[#0f2318] underline"
                >
                  {googleSt.connected ? "Reconnect Google" : "Connect Google"}
                </a>
              ) : (
                <p className="mt-2 text-[12px] text-[#888]">Google OAuth not configured on server.</p>
              )}
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#888]">Send invites to</p>
            <div className="mb-4 rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white p-3">
              {payload.client?.email ? (
                <RecipientRow
                  initials={(payload.client.full_name || "CL").slice(0, 2).toUpperCase()}
                  name={payload.client.full_name}
                  sub={`Client · ${payload.client.email}`}
                  on={
                    (() => {
                      const em = payload.client!.email!.toLowerCase();
                      const row = recipients.find((r) => r.email === em);
                      if (!row) return true;
                      return row.enabled;
                    })()
                  }
                  onToggle={(on) => {
                    const email = payload.client!.email!.toLowerCase();
                    const next = [...recipients];
                    const ix = next.findIndex((r) => r.email === email);
                    if (ix >= 0) next[ix] = { ...next[ix]!, enabled: on };
                    else
                      next.push({
                        name: payload.client!.full_name,
                        email,
                        role: "Client",
                        enabled: on,
                      });
                    void patchProjectCalendar({ calendar_recipients: next });
                  }}
                />
              ) : null}
              {recipients
                .filter((r) => r.email !== payload.client?.email?.toLowerCase())
                .map((r) => (
                  <RecipientRow
                    key={r.email}
                    initials={r.name.slice(0, 2).toUpperCase()}
                    name={r.name}
                    sub={`${r.role} · ${r.email}`}
                    on={r.enabled}
                    onToggle={(on) => {
                      const next = recipients.map((x) => (x.email === r.email ? { ...x, enabled: on } : x));
                      void patchProjectCalendar({ calendar_recipients: next });
                    }}
                  />
                ))}
              <button
                type="button"
                className="mt-2 w-full rounded-[10px] border-[0.5px] border-[#e0e0e0] py-2 text-[13px] font-semibold"
                onClick={() => {
                  const name = window.prompt("Name");
                  if (name == null) return;
                  const email = window.prompt("Email");
                  if (!email?.trim()) return;
                  const next = [...recipients, { name: name.trim(), email: email.trim().toLowerCase(), role: "Sub", enabled: true }];
                  void patchProjectCalendar({ calendar_recipients: next });
                }}
              >
                + Add person
              </button>
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#888]">Shareable link</p>
            <div className="mb-4 rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white p-3 text-[13px]">
              <p className="text-[#666]">Works with Google, Apple, and Outlook.</p>
              <div className="mt-2 break-all rounded-[8px] border-[0.5px] border-[#e0e0e0] p-2 text-[12px]">
                {shareUrl || "Generating link…"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-[10px] border-[0.5px] border-[#e0e0e0] px-3 py-2 text-[12px] font-semibold"
                  onClick={() => shareUrl && void navigator.clipboard.writeText(shareUrl)}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  className="rounded-[10px] border-[0.5px] border-[#e0e0e0] px-3 py-2 text-[12px] font-semibold"
                  onClick={() => {
                    if (!shareUrl) return;
                    window.open(`sms:?&body=${encodeURIComponent(shareUrl)}`);
                  }}
                >
                  Send by text
                </button>
                <button
                  type="button"
                  className="rounded-[10px] border-[0.5px] border-[#e0e0e0] px-3 py-2 text-[12px] font-semibold"
                  onClick={() => {
                    if (!shareUrl) return;
                    window.open(`mailto:?subject=Schedule&body=${encodeURIComponent(shareUrl)}`);
                  }}
                >
                  Email
                </button>
                <a
                  href={shareSlug ? `/api/public/calendar/${encodeURIComponent(shareSlug)}/ics` : "#"}
                  download
                  className="rounded-[10px] border-[0.5px] border-[#e0e0e0] px-3 py-2 text-[12px] font-semibold text-[#111] no-underline"
                >
                  Download .ics
                </a>
              </div>
            </div>

            <button
              type="button"
              disabled={pushBusy}
              className="mb-2 w-full rounded-[10px] bg-[#0f2318] py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
              onClick={() => {
    const emails: string[] = [];
    if (payload.client?.email) {
      const em = payload.client.email.toLowerCase();
      const row = recipients.find((r) => r.email === em);
      const clientOn = row ? row.enabled : true;
      if (clientOn) emails.push(em);
    }
    for (const r of recipients) {
      if (r.enabled && !emails.includes(r.email)) emails.push(r.email);
    }
                void runPushAll(emails);
              }}
            >
              Push to all selected →
            </button>
            <button
              type="button"
              className="mb-4 w-full rounded-[10px] border-[0.5px] border-[#e0e0e0] py-3 text-[14px] font-semibold"
              onClick={() => shareSlug && window.open(`/cal/${encodeURIComponent(shareSlug)}`, "_blank")}
            >
              Preview what they&apos;ll see
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecipientRow({
  initials,
  name,
  sub,
  on,
  onToggle,
}: {
  initials: string;
  name: string;
  sub: string;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b-[0.5px] border-[#f0f0f0] py-2 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[11px] font-bold">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{name}</div>
        <div className="text-[11px] text-[#888]">{sub}</div>
      </div>
      <button
        type="button"
        className={`relative h-[24px] w-[44px] shrink-0 rounded-full ${on ? "bg-[#2d7a2d]" : "bg-[#ccc]"}`}
        onClick={() => onToggle(!on)}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(20px)" : "none" }}
        />
      </button>
    </div>
  );
}

function TradeTimelineCard({
  t,
  onAssign,
}: {
  t: ScheduleTrade & { minD?: Date | null; maxD?: Date | null; prog?: number; status?: string };
  onAssign: () => void;
}) {
  const need = Math.max(1, t.days || 1);
  const prog = t.prog ?? Math.min(100, Math.round((100 * t.calendarSlots.length) / need));
  const status = (t.status as "complete" | "active" | "pending") ?? (prog >= 100 ? "complete" : prog > 0 ? "active" : "pending");
  const st =
    status === "complete"
      ? { dot: "#2d7a2d", bar: "#2d7a2d", label: "Complete" }
      : status === "active"
        ? { dot: "#f5a623", bar: "#f5a623", label: "Active" }
        : { dot: "#aaa", bar: "#aaa", label: "Pending" };
  const rng =
    t.minD && t.maxD
      ? fmtRange(t.minD, t.maxD)
      : t.calendarSlots.length
        ? t.calendarSlots.map((s) => s.date).join(", ")
        : "—";
  const bg = tradeScheduleBg(t.tradeId);
  return (
    <div
      className="mb-3 overflow-hidden rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white"
      style={{ boxShadow: "none" }}
    >
      <div className="flex gap-3 p-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[18px]"
          style={{ background: bg }}
          aria-hidden
        >
          ●
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-[#111]">{t.tradeName}</div>
          <div className="text-[11px] text-[#aaa]">{t.roomName}</div>
          <div className="mt-1 text-[11px] text-[#555]" style={mono}>
            {rng}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px]" style={mono}>
            {t.days}d
          </div>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: st.dot }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#888]">{st.label}</span>
          </div>
        </div>
      </div>
      <div className="h-1 bg-[#f0f0f0]" style={{ margin: "0 12px 8px" }}>
        <div className="h-full rounded-full" style={{ width: `${prog}%`, background: st.bar }} />
      </div>
      <button
        type="button"
        className="w-full border-t-[0.5px] border-[#f0f0f0] py-2.5 text-[12px] font-semibold text-[#0f2318]"
        onClick={onAssign}
      >
        {t.calendarSlots.length
          ? `Assigned: ${t.calendarSlots.map((s) => s.date).join(", ")}`
          : "Tap to assign"}
      </button>
    </div>
  );
}

function DayDetailPanel({
  ymdStr,
  trades,
  onClearDay,
  onClose,
  onUpdateSlot,
  onSetDay,
  onRemoveTradeDay,
}: {
  ymdStr: string;
  trades: ScheduleTrade[];
  onClearDay: () => void;
  onClose: () => void;
  onUpdateSlot: (t: ScheduleTrade, ymd: string, p: Partial<CalendarSlot>) => Promise<void>;
  onSetDay: (t: ScheduleTrade, ymd: string, duration: string, notes: string) => Promise<void>;
  onRemoveTradeDay: (t: ScheduleTrade, ymd: string) => Promise<void>;
}) {
  const d = parseYmd(ymdStr);
  const head = d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ymdStr;
  return (
    <div className="mt-4 rounded-[10px] border-[0.5px] border-[#e0e0e0] bg-white p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold text-[#111]">{head}</div>
        </div>
        <button type="button" className="text-[13px] font-semibold text-[#c62828]" onClick={onClearDay}>
          Clear day
        </button>
      </div>
      {trades.map((t) => {
        const need = Math.max(0, t.days);
        const have = t.calendarSlots.length;
        const rem = Math.max(0, need - have);
        const existing = slotOnDay(t.calendarSlots, ymdStr);
        const canAdd = need > 0 && !existing && have < need;
        return (
          <div key={t.roomTradeId} className="mb-4 border-t-[0.5px] border-[#f0f0f0] pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: tradeScheduleBg(t.tradeId) }} />
              <span className="text-[14px] font-medium">{t.tradeName}</span>
              <span className="text-[11px] text-[#888]">· {rem} left</span>
            </div>
            <p className="mt-1 text-[11px] text-[#aaa]">{t.roomName}</p>
            {existing ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["full", "am", "pm"] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      className="rounded-[100px] border-[0.5px] px-3 py-1.5 text-[12px] font-semibold"
                      style={{
                        background: existing.duration === dur ? "#0f2318" : "#fff",
                        color: existing.duration === dur ? "#fff" : "#111",
                        borderColor: existing.duration === dur ? "#0f2318" : "#e0e0e0",
                      }}
                      onClick={() => void onUpdateSlot(t, ymdStr, { duration: dur })}
                    >
                      {dur === "full" ? "Full day" : dur === "am" ? "AM only" : "PM only"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium text-[#888]">Day notes</p>
                <textarea
                  className="mt-1 w-full resize-y rounded-[8px] border-[0.5px] border-[#e0e0e0] p-2 text-[13px] outline-none"
                  style={{ minHeight: 72 }}
                  placeholder="What's happening today? Appears in calendar event."
                  defaultValue={existing.notes}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== existing.notes) void onUpdateSlot(t, ymdStr, { notes: v });
                  }}
                />
                <p className="mt-1 text-[11px] text-[#aaa]">This note appears in the calendar event description</p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-[#c62828]"
                  onClick={() => void onRemoveTradeDay(t, ymdStr)}
                >
                  Remove from this day
                </button>
              </>
            ) : canAdd ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["full", "am", "pm"] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      className="rounded-[100px] border-[0.5px] border-[#e0e0e0] bg-white px-3 py-1.5 text-[12px] font-semibold"
                      onClick={() => void onSetDay(t, ymdStr, dur, "")}
                    >
                      {dur === "full" ? "Full day" : dur === "am" ? "AM only" : "PM only"}
                    </button>
                  ))}
                </div>
              </>
            ) : need === 0 ? (
              <p className="mt-1 text-[12px] text-[#888]">No duration set for this trade.</p>
            ) : (
              <p className="mt-1 text-[12px] text-[#888]">All days assigned. Remove a date to add here.</p>
            )}
          </div>
        );
      })}
      <button type="button" className="mt-1 w-full py-2 text-[13px] font-semibold text-[#555]" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
