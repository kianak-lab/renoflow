import { NextResponse } from "next/server";
import { loadPublicCalendarBySlug } from "@/lib/public-calendar-data";
import { buildIcsCalendar } from "@/lib/icalendar";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteCtx) {
  const { slug } = await context.params;
  const data = await loadPublicCalendarBySlug(slug ?? "");
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ics = buildIcsCalendar(
    data.events.map((ev, i) => ({
      uid: `renoflow-${data.slug}-${ev.date}-${ev.tradeId}-${ev.roomName}-${i}@renoflowapp.com`,
      date: ev.date,
      summary: `${ev.tradeName} — ${data.projectName}`,
      description: [ev.notes && `Notes: ${ev.notes}`, `Room: ${ev.roomName}`].filter(Boolean).join("\n"),
      location: data.address || undefined,
      duration: ev.duration as "full" | "am" | "pm",
    })),
    { calName: `${data.projectName} schedule` },
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="renoflow-${data.slug}.ics"`,
    },
  });
}
