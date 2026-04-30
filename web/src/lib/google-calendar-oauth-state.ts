import { createHmac, timingSafeEqual } from "crypto";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signCalendarOAuthState(uid: string, secret: string): string {
  const payload = JSON.stringify({ uid, t: Date.now() });
  const h = createHmac("sha256", secret).update(payload).digest();
  return b64url(Buffer.from(payload, "utf8")) + "." + b64url(h);
}

export function verifyCalendarOAuthState(
  state: string,
  secret: string,
): { uid: string } | null {
  const parts = String(state || "").split(".");
  if (parts.length !== 2) return null;
  try {
    const p0 = parts[0]!;
    let payloadStr = p0.replace(/-/g, "+").replace(/_/g, "/");
    const pad = payloadStr.length % 4;
    if (pad) payloadStr += "=".repeat(4 - pad);
    const payload = Buffer.from(payloadStr, "base64").toString("utf8");
    const expected = createHmac("sha256", secret).update(payload).digest();
    let sigB64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad2 = sigB64.length % 4;
    if (pad2) sigB64 += "=".repeat(4 - pad2);
    const got = Buffer.from(sigB64, "base64");
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    const j = JSON.parse(payload) as { uid?: string; t?: number };
    if (!j.uid || typeof j.uid !== "string") return null;
    if (!j.t || Math.abs(Date.now() - j.t) > 15 * 60 * 1000) return null;
    return { uid: j.uid };
  } catch {
    return null;
  }
}
