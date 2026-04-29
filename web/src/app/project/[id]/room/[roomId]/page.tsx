import RoomDetailClient from "./room-detail-client";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  return <RoomDetailClient projectId={id} roomId={roomId} />;
}
