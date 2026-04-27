/** Production web app — OAuth must not target removed *.vercel.app preview deployments. */
const CANONICAL_PRODUCTION_ORIGIN = "https://www.renoflowapp.com";

function originFromPublicAppUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const withProto = raw.includes("://") ? raw.trim() : `https://${raw.trim()}`;
    const u = new URL(withProto);
    // Stale Vercel dashboard values often point at deleted preview URLs (DEPLOYMENT_NOT_FOUND).
    if (u.hostname.endsWith(".vercel.app")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Canonical site origin for OAuth redirect_to. Prefer NEXT_PUBLIC_APP_URL so it always
 * matches Supabase "Site URL" / redirect allow list (fixes www vs bare domain on mobile).
 */
export function getPublicOriginForAuth(): string {
  if (typeof window === "undefined") return "";

  const envOrigin = originFromPublicAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (envOrigin) return envOrigin;

  const live = window.location.origin;

  // Branch / preview deploys: return to the same host (NEXT_PUBLIC_VERCEL_ENV is set by Vercel).
  if (live.endsWith(".vercel.app") && process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
    return live;
  }

  // Production build opened on a *.vercel.app hostname (bad bookmark / old Site URL) → use live site.
  if (live.endsWith(".vercel.app") && process.env.NODE_ENV === "production") {
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
