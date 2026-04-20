import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";

/**
 * Resolve final.html without using `..` from process.cwd(): on Vercel, cwd is often
 * `/var/task/web`, and join(cwd, "..", "final.html") becomes `/var/task/final.html`
 * (wrong — file is not there). Public/ CDN files are also not on disk inside the
 * Lambda unless explicitly traced — use co-located + tracing includes.
 */
export async function GET() {
  const routeDir = dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();

  const candidates = [
    join(routeDir, "final.html"),
    join(cwd, "public", "final.html"),
    join(cwd, "final.html"),
  ];

  if (process.env.NODE_ENV !== "production") {
    candidates.push(join(cwd, "..", "final.html"));
  }

  let lastError: unknown;
  for (const filePath of candidates) {
    try {
      const html = await readFile(filePath, "utf8");
      return new NextResponse(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (e) {
      lastError = e;
    }
  }

  console.error("[final] failed to read final.html", lastError);
  return new NextResponse(
    "final.html could not be loaded. Run `npm run sync-final` before `npm run build` so src/app/final/final.html exists.",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
