import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const inApp = join(process.cwd(), "public", "final.html");
  const legacyParent = join(process.cwd(), "..", "final.html");
  let html: string;
  try {
    html = await readFile(inApp, "utf8");
  } catch {
    try {
      html = await readFile(legacyParent, "utf8");
    } catch {
      return new NextResponse(
        "final.html was not found. Run `npm run sync-final` or ensure public/final.html exists.",
        { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
  }

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
