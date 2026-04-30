import { NextResponse } from "next/server";
import { loadPublicCalendarBySlug } from "@/lib/public-calendar-data";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteCtx) {
  const { slug } = await context.params;
  const data = await loadPublicCalendarBySlug(slug ?? "");
  if (!data) {
    return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}
