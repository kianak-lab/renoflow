import type { ReactNode } from "react";
import { IBM_Plex_Sans } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className={`${plexSans.className} min-h-screen antialiased`}>{children}</div>;
}
