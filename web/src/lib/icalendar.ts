/** Build RFC 5545 iCalendar text (DATE-only all-day events). */

export type IcsEventInput = {
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description?: string;
  location?: string;
  /** full = all day; am/pm = half-day (still one calendar day block for simplicity) */
  duration?: "full" | "am" | "pm";
};

function escText(s: string): string {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let out = "";
  let i = 0;
  while (i < line.length) {
    const chunk = i === 0 ? line.slice(i, 75) : " " + line.slice(i, i + 74);
    out += (out ? "\r\n" : "") + chunk;
    i += i === 0 ? 75 : 74;
  }
  return out;
}

export function buildIcsCalendar(
  events: IcsEventInput[],
  opts?: { prodId?: string; calName?: string },
): string {
  const prodId = opts?.prodId ?? "-//RenoFlow//Schedule//EN";
  const calName = opts?.calName ?? "RenoFlow schedule";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:" + escText(prodId),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escText(calName),
  ];

  for (const ev of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
    const [y, m, d] = ev.date.split("-").map(Number);
    const start = new Date(Date.UTC(y!, m! - 1, d!));
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
    const endStr = `${end.getUTCFullYear()}${String(end.getUTCMonth() + 1).padStart(2, "0")}${String(end.getUTCDate()).padStart(2, "0")}`;
    const startStr = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
    const durNote =
      ev.duration === "am" ? " (AM)" : ev.duration === "pm" ? " (PM)" : "";

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine("UID:" + escText(ev.uid)));
    lines.push("DTSTAMP:" + formatIcsUtcStamp(new Date()));
    lines.push(`DTSTART;VALUE=DATE:${startStr}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
    lines.push(foldLine("SUMMARY:" + escText(ev.summary + durNote)));
    if (ev.description?.trim()) {
      lines.push(foldLine("DESCRIPTION:" + escText(ev.description.trim())));
    }
    if (ev.location?.trim()) {
      lines.push(foldLine("LOCATION:" + escText(ev.location.trim())));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function formatIcsUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
