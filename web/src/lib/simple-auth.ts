const COOKIE_NAME = "renoflow_session";

const encoder = new TextEncoder();

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Trim + strip UTF-8 BOM if an editor inserted it on the value line. */
function cleanEnv(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  return s.replace(/^\uFEFF/, "").trim();
}

export function getAuthSecret(): string {
  const fromEnv = cleanEnv(process.env.RENOFLOW_AUTH_SECRET);
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "renoflow-dev-auth-secret";
  return "";
}

export function getExpectedUsername(): string {
  return cleanEnv(process.env.RENOFLOW_USERNAME) || "renoflow";
}

export function getExpectedPassword(): string {
  return cleanEnv(process.env.RENOFLOW_PASSWORD) || "renoflow";
}

export { COOKIE_NAME };

export type SessionPayload = { exp: number; uid?: string };

async function readVerifiedSessionPayload(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const payloadBytes = base64UrlDecodeToBytes(parts[0]!);
    const payload = new TextDecoder().decode(payloadBytes);
    const parsed = JSON.parse(payload) as SessionPayload;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const key = await importHmacKey(secret);
    const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const got = base64UrlDecodeToBytes(parts[1]!);
    const exp = new Uint8Array(expectedSig);
    if (got.length !== exp.length) return null;
    let diff = 0;
    for (let i = 0; i < exp.length; i++) diff |= got[i]! ^ exp[i]!;
    if (diff !== 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSessionToken(secret: string, uid?: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = JSON.stringify(uid ? { exp, uid } : { exp });
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${base64UrlEncode(encoder.encode(payload))}.${base64UrlEncode(sig)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const p = await readVerifiedSessionPayload(token, secret);
  return p !== null;
}

export async function verifySessionCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return verifySessionToken(value, getAuthSecret());
}

/** Verified session payload (includes Supabase user id when embedded at login). */
export async function readSessionFromCookieValue(
  value: string | undefined,
): Promise<SessionPayload | null> {
  if (!value) return null;
  return readVerifiedSessionPayload(value, getAuthSecret());
}
