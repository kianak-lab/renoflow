import { notFound } from "next/navigation";
import { loadPublicCalendarBySlug } from "@/lib/public-calendar-data";
import { CalendarPublicView } from "./calendar-public-view";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function PublicCalendarPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadPublicCalendarBySlug(slug ?? "");
  if (!data) notFound();
  return <CalendarPublicView data={data} />;
}
