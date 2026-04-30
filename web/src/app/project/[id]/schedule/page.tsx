import ScheduleClient from "./schedule-client";

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScheduleClient projectId={(id ?? "").trim()} />;
}
