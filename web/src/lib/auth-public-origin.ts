/**
 * Canonical site origin for OAuth redirect_to. Prefer NEXT_PUBLIC_APP_URL so it always
 * matches Supabase "Site URL" / redirect allow list (fixes www vs bare domain on mobile).
 */
export function getPublicOriginForAuth(): string {
  if (typeof window === "undefined") return "";

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const withProto = raw.includes("://") ? raw : `https://${raw}`;
      return new URL(withProto).origin;
    } catch {
      /* use window */
    }
  }

  return window.location.origin;
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
