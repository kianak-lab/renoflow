import type { NextRequest } from "next/server";

/**
 * Stable origin from client headers.
 * Prefer `Host` over `x-forwarded-host`: in `next dev`, forwarded host is often
 * `localhost` even when the browser opened `127.0.0.1`, which breaks redirects
 * and can surface as 500s on the follow-up URL.
 */
export function getRequestOrigin(
  request: NextRequest | Pick<Request, "headers">,
): string {
  const rawHost =
    request.headers.get("host")?.trim() ||
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    "127.0.0.1:3000";
  let proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (proto.includes(",")) proto = proto.split(",")[0]!.trim();
  return `${proto}://${rawHost}`;
}
