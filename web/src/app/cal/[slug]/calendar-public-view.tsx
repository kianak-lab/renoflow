"use client";

import type { PublicCalendarPayload } from "@/lib/public-calendar-data";
import { tradeScheduleBg, tradeScheduleDot } from "@/lib/schedule-trade-colors";
import Link from "next/link";
import { useMemo } from "react";

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

const mono = { fontFamily: "var(--rf-plex-mono), ui-monospace, monospace" } as const;

export function CalendarPublicView({ data }: { data: PublicCalendarPayload }) {
  const days = useMemo(() => groupByDate(data.events), [data.events]);
  const icsHref = `/api/public/calendar/${encodeURIComponent(data.slug)}/ics`;

  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#111]">
      <header
        className="shrink-0 px-4 pb-6 pt-[calc(16px+env(safe-area-inset-top,0px))]"
        style={{ background: "#0f2318" }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Project schedule
        </p>
        <h1 className="mt-1 text-[22px] font-medium leading-tight text-white">{data.companyName}</h1>
        {data.companyPhone ? (
          <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.55)", ...mono }}>
            <a
              href={`tel:${data.companyPhone.replace(/\s/g, "")}`}
              className="text-inherit underline-offset-2 hover:underline"
            >
              {data.companyPhone}
            </a>
          </p>
        ) : null}
        <p className="mt-3 text-[14px] font-medium text-white">{data.projectName}</p>
        {data.address ? (
          <p className="mt-1 text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
            {data.address}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={icsHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[100px] bg-white px-4 text-[12px] font-semibold text-[#0f2318] no-underline"
          >
            Add to My Calendar
          </a>
          <a
            href={icsHref}
            download
            className="inline-flex min-h-[44px] items-center justify-center rounded-[100px] border-[0.5px] border-[#e0e0e0] bg-transparent px-4 text-[12px] font-semibold text-white no-underline"
            style={{ borderColor: "rgba(255,255,255,0.45)" }}
          >
            Download .ics
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {days.length === 0 ? (
          <p className="text-center text-[14px] text-[#888]">No scheduled days yet.</p>
        ) : null}
        {days.map((day, idx) => {
          const d = parseYmd(day.date);
          const gap = idx > 0 ? gapLabel(days[idx - 1]!.date, day.date) : null;
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
          const dotColor = tradeScheduleDot(day.rows[0]!.tradeId);
          const dateBlockBg = tradeScheduleBg(day.rows[0]!.tradeId);

          return (
            <div key={day.date}>
              {gap ? (
                <div
                  className="my-5 border-t-[0.5px] border-dashed border-[#e0e0e0] pt-5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]"
                >
                  {gap}
                </div>
              ) : null}
              <article
                className="mb-3 overflow-hidden bg-white"
                style={{ border: "0.5px solid #e0e0e0", borderRadius: 10 }}
              >
                <div className="flex gap-3 p-4">
                  <div
                    className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-[10px] py-3 text-center"
                    style={{ background: dateBlockBg }}
                  >
                    <span className="text-[11px] font-medium uppercase text-[#888]">
                      {d.toLocaleDateString("en-CA", { month: "short" })}
                    </span>
                    <span className="text-[26px] font-medium leading-none text-[#111]" style={mono}>
                      {d.getDate()}
                    </span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-[#888]">
                      {d.toLocaleDateString("en-CA", { weekday: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: dotColor }}
                      />
                      <div>
                        <h2 className="text-[15px] font-medium leading-snug text-[#111]">{title}</h2>
                        {rooms ? <p className="mt-1 text-[13px] text-[#555]">{rooms}</p> : null}
                        {notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#888]">
                            {notes}
                          </p>
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
            className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-[10px] bg-[#0f2318] text-[14px] font-semibold text-white no-underline"
          >
            Add all to my calendar
          </a>
        ) : null}

        <p className="mt-8 text-center text-[12px] text-[#aaa]">
          <Link href="/" className="text-[#0f2318] underline-offset-2 hover:underline">
            RenoFlow home
          </Link>
        </p>
      </main>
    </div>
  );
}
