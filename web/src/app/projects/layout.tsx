import type { CSSProperties, ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${plexSans.className} min-h-0 overflow-hidden bg-[#ffffff] text-[#111] [height:100svh] max-h-[100svh]`}
      style={
        {
          ["--rf-plex-mono" as string]: plexMono.style.fontFamily,
          ["--rf-plex-serif" as string]: plexSerif.style.fontFamily,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
