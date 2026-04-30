"use client";

import type { PublicCalendarPayload } from "@/lib/public-calendar-data";
import Link from "next/link";
import { useMemo } from "react";

const TRADE_DOT: Record<string, string> = {
  demo: "#FFE000",
  plumbing: "#47a0e8",
  electrical: "#e8c547",
  tile: "#a0e847",
  framing: "#e87747",
};

type Row = PublicCalendarPayload["events"][0];

type DayCard = {
  date: string;
  rows: Row[];
};

function groupByDate(events: Row[]): DayCard[] {
  const map = new Map<string, Row[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({ date, rows }));
}

function fmtDuration(d: string): string {
  if (d === "am") return "AM";
  if (d === "pm") return "PM";
  return "";
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function gapLabel(prev: string, cur: string): string | null {
  const a = parseYmd(prev);
  const b = parseYmd(cur);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff <= 1) return null;
  if (diff < 14) return `Next visit in ${diff} days`;
  const w = Math.round(diff / 7);
  return `Next visit in ${w} week${w !== 1 ? "s" : ""}`;
}

export function CalendarPublicView({ data }: { data: PublicCalendarPayload }) {
  const days = useMemo(() => groupByDate(data.events), [data.events]);
  const icsHref = `/api/public/calendar/${encodeURIComponent(data.slug)}/ics`;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-4 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Schedule</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{data.companyName}</h1>
        {data.companyPhone ? (
          <p className="mt-1 text-sm text-neutral-600">
            <a href={`tel:${data.companyPhone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
              {data.companyPhone}
            </a>
          </p>
        ) : null}
        <p className="mt-3 text-sm font-medium text-neutral-800">{data.projectName}</p>
        {data.address ? <p className="mt-1 text-sm text-neutral-600">{data.address}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={icsHref}
            className="rounded-lg bg-[#0f2318] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Add to My Calendar
          </a>
          <a
            href={icsHref}
            download
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50"
          >
            Download .ics
          </a>
          <Link href="/" className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:underline">
            RenoFlow home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        {days.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">No scheduled days yet.</p>
        ) : null}
        {days.map((day, idx) => {
          const d = parseYmd(day.date);
          const gap =
            idx > 0 ? gapLabel(days[idx - 1]!.date, day.date) : null;
          const title = day.rows
            .map((r) => {
              const frag = fmtDuration(r.duration);
              return frag ? `${r.tradeName} ${frag}` : r.tradeName;
            })
            .join(" · ");
          const rooms = [...new Set(day.rows.map((r) => r.roomName).filter(Boolean))].join(", ");
          const notes = day.rows
            .map((r) => r.notes.trim())
            .filter(Boolean)
            .join("\n\n");
          const dotColor = TRADE_DOT[day.rows[0]!.tradeId] ?? "#666";

          return (
            <div key={day.date}>
              {gap ? (
                <div className="my-6 border-t border-dashed border-neutral-300 pt-6 text-center text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {gap}
                </div>
              ) : null}
              <article className="mb-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="flex w-16 flex-col items-center justify-center rounded-xl bg-neutral-100 py-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-neutral-500">
                      {d.toLocaleDateString("en-CA", { month: "short" })}
                    </span>
                    <span className="text-2xl font-semibold leading-none">{d.getDate()}</span>
                    <span className="mt-1 text-[10px] text-neutral-500">
                      {d.toLocaleDateString("en-CA", { weekday: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
                      <div>
                        <h2 className="text-base font-semibold leading-snug">{title}</h2>
                        {rooms ? <p className="mt-1 text-sm text-neutral-600">{rooms}</p> : null}
                        {notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-500">{notes}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          );
        })}

        {days.length > 0 ? (
          <a
            href={icsHref}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#0f2318] py-3.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Add all to my calendar
          </a>
        ) : null}
      </main>
    </div>
  );
}
