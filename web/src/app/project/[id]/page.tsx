import ProjectHubClient from "./project-hub-client";

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectHubClient projectId={id} />;
}
