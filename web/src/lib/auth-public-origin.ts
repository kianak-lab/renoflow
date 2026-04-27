/** Production web app — OAuth redirect_to host (must match Supabase redirect allow list). */
const CANONICAL_PRODUCTION_ORIGIN = "https://www.renoflowapp.com";

function originFromPublicAppUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const withProto = raw.includes("://") ? raw.trim() : `https://${raw.trim()}`;
    const u = new URL(withProto);
    // Stale env/dashboard values often point at deleted *.vercel.app previews (DEPLOYMENT_NOT_FOUND).
    if (u.hostname.endsWith(".vercel.app")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Explicit OAuth origin override (e.g. a branch preview). Allows *.vercel.app when set on purpose.
 */
function originFromExplicitOAuthRedirect(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const withProto = raw.includes("://") ? raw.trim() : `https://${raw.trim()}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

function firstEnvOAuthOrigin(): string | null {
  const override = originFromExplicitOAuthRedirect(process.env.NEXT_PUBLIC_OAUTH_REDIRECT_ORIGIN);
  if (override) return override;
  const fromApp = originFromPublicAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (fromApp) return fromApp;
  return originFromPublicAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

/**
 * Canonical site origin for OAuth redirect_to. Uses NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL.
 * Never uses the current browser host when it is *.vercel.app (avoids preview deployments after OAuth).
 */
export function getPublicOriginForAuth(): string {
  if (typeof window === "undefined") return "";

  const envOrigin = firstEnvOAuthOrigin();
  if (envOrigin) return envOrigin;

  const live = window.location.origin;
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") return live;

  if (host === "renoflowapp.com" || host === "www.renoflowapp.com") {
    return CANONICAL_PRODUCTION_ORIGIN;
  }

  if (live.endsWith(".vercel.app")) {
    return CANONICAL_PRODUCTION_ORIGIN;
  }

  return live;
}

/**
 * OAuth return URL (path must be listed in Supabase → Authentication → URL Configuration).
 * Default: /api/auth/callback. Override with NEXT_PUBLIC_SUPABASE_OAUTH_CALLBACK_PATH=/auth/callback if needed.
 */
export function getOAuthCallbackPath(): "/api/auth/callback" | "/auth/callback" {
  const p = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CALLBACK_PATH?.trim();
  if (p === "/auth/callback") return "/auth/callback";
  return "/api/auth/callback";
}

export function buildOAuthRedirectTo(nextPath: string): string {
  const origin = getPublicOriginForAuth();
  const path = getOAuthCallbackPath();
  const next = encodeURIComponent(nextPath);
  return `${origin}${path}?next=${next}`;
}

export function logOAuthRedirectTo(redirectTo: string, context: string) {
  console.info(
    `[RenoFlow auth:${context}] OAuth redirectTo (must exactly match a Supabase Redirect URL):`,
    redirectTo,
  );
}
