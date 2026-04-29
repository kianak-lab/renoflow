import { Suspense } from "react";
import DemolitionTradeApp from "@/components/trades/demolition/demolition-trade-app";

export const dynamic = "force-dynamic";

function pickSearchParam(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function DemolitionTradePage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string | string[]; dbRoomId?: string | string[] }>;
}) {
  const raw = await searchParams;
  const initialPid = pickSearchParam(raw.pid).trim();
  const initialDbRoomId = pickSearchParam(raw.dbRoomId).trim();

  return (
    <Suspense fallback={<div className="fixed inset-0 z-[500] bg-white" />}>
      <DemolitionTradeApp initialPid={initialPid} initialDbRoomId={initialDbRoomId} />
    </Suspense>
  );
}
