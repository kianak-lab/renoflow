import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Site Clean dashboard strip: #0f2318 fills edge-to-edge; safe-area padding lets content sit below the status bar.
 */
export function DashboardHeader({ children, className }: Props) {
  return (
    <header
      className={className}
      style={{
        background: "#0f2318",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {children}
    </header>
  );
}
