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
   * Ship final.html inside the /final Route Handler bundle on Vercel (public/ alone is CDN-only).
   * sync-final-html.cjs copies the repo root file to src/app/final/final.html before build.
   */
  outputFileTracingIncludes: {
    "/final": ["./src/app/final/final.html"],
  },
};

export default nextConfig;
