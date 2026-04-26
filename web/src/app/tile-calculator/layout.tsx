import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./tile-calculator.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Tile Calculator — RenoFlow",
  description:
    "Wall, floor, and ceiling tile quantities, substrate, and glass door estimates for bathrooms and showers.",
};

export default function TileCalculatorLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} min-h-full`}
      style={{ background: "#ffffff" }}
    >
      {children}
    </div>
  );
}
