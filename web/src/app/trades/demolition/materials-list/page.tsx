import { Suspense } from "react";
import DemolitionMaterialsListApp from "@/components/trades/demolition/demolition-materials-list-app";

export const dynamic = "force-dynamic";

function pickSearchParam(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function DemolitionMaterialsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    pid?: string | string[];
    dbRoomId?: string | string[];
    ri?: string | string[];
    ti?: string | string[];
  }>;
}) {
  const raw = await searchParams;
  const initialPid = pickSearchParam(raw.pid).trim();
  const initialDbRoomId = pickSearchParam(raw.dbRoomId).trim();
  const initialRi = pickSearchParam(raw.ri).trim();
  const initialTi = pickSearchParam(raw.ti).trim();

  return (
    <Suspense fallback={<div className="fixed inset-0 z-[500] bg-white" />}>
      <DemolitionMaterialsListApp
        initialPid={initialPid}
        initialDbRoomId={initialDbRoomId}
        initialRi={initialRi}
        initialTi={initialTi}
      />
    </Suspense>
  );
}
