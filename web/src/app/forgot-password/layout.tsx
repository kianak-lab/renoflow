import type { ReactNode } from "react";
import { authShellViewport } from "@/lib/auth-viewport";

export const viewport = authShellViewport;

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
