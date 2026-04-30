import { redirect } from "next/navigation";

/** Legacy /timeline URL forwards to the in-app Schedule page. */
export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pid = (id ?? "").trim();
  if (!pid) {
    redirect("/projects");
  }
  redirect(`/project/${encodeURIComponent(pid)}/schedule`);
}
