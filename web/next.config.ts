import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBuildVersionForClient(): string {
  try {
    const p = path.join(__dirname, "public", "build-version.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    return "development";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_BUILD_VERSION: readBuildVersionForClient(),
  },
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
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/build-version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
