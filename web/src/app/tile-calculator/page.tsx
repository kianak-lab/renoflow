import { Suspense } from "react";
import { TileCalculatorApp } from "./TileCalculatorApp";

function TileCalcFallback() {
  return (
    <div
      className="tile-calc"
      style={{ minHeight: "100vh", background: "#0e0e0e", color: "#e8e8e8" }}
    />
  );
}

export default function TileCalculatorPage() {
  return (
    <Suspense fallback={<TileCalcFallback />}>
      <TileCalculatorApp />
    </Suspense>
  );
}
