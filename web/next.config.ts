import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Pin the app root so Next does not pick a stray lockfile outside this folder (e.g. user home).
   */
  outputFileTracingRoot: path.join(__dirname),
  /**
   * Bundle `public/final.html` with the /final Route Handler on Vercel (see scripts/sync-final-html.cjs).
   */
  outputFileTracingIncludes: {
    "/final": ["./public/final.html"],
  },
};

export default nextConfig;
