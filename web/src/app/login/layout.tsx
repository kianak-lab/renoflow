import type { Metadata } from "next";
import type { ReactNode } from "react";
import { authShellViewport } from "@/lib/auth-viewport";

export const viewport = authShellViewport;

/** iOS standalone / edge-to-edge: content paints under status bar; header fills with safe-area padding */
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "RenoFlow",
    statusBarStyle: "black-translucent",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
