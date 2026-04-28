import { Suspense } from "react";
import DemolitionTradeApp from "@/components/trades/demolition/demolition-trade-app";

export const dynamic = "force-dynamic";

export default function DemolitionTradePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[200] bg-white" />}>
      <DemolitionTradeApp />
    </Suspense>
  );
}
