import type { Viewport } from "next";

/**
 * Auth routes: edge-to-edge on iOS (viewport-fit=cover), theme-color matches header #0f2318
 * so Safari / system UI chrome matches the status bar area.
 */
export const authShellViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f2318",
};
