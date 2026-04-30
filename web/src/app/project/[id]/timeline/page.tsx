import { redirect } from "next/navigation";

/** Canonical entry for project timeline + calendar (SPA in /final). No extra data fetch — single redirect. */
export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pid = (id ?? "").trim();
  if (!pid) {
    redirect("/final?pg=tl");
  }
  redirect(`/final?project=${encodeURIComponent(pid)}&pg=tl`);
}
