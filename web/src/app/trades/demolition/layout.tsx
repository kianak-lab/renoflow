import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Demolition — RenoFlow",
  description: "Demolition trade calculator",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FFE000",
};

export default function DemolitionTradeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
