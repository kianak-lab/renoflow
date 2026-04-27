import type { Metadata } from "next";
import type { ReactNode } from "react";
import { authShellViewport } from "@/lib/auth-viewport";

export const viewport = authShellViewport;

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "RenoFlow",
    statusBarStyle: "black-translucent",
  },
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
