import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Same pattern as /trades/demolition header row: viewport-fit=cover (root layout) + this padding.
 */
export function DashboardHeader({ children, className }: Props) {
  return (
    <header
      className={className}
      style={{
        background: "#0f2318",
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
      }}
    >
      {children}
    </header>
  );
}
