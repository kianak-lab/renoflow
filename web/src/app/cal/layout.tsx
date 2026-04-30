import type { CSSProperties, ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

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

export default function PublicCalendarLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${plexSans.className} min-h-dvh bg-white text-[#111]`}
      style={
        {
          ["--rf-plex-mono" as string]: plexMono.style.fontFamily,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
