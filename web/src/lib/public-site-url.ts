/**
 * Public site URL from environment. NEXT_PUBLIC_SITE_URL is treated as an alias of NEXT_PUBLIC_APP_URL.
 */
export function getConfiguredPublicSiteUrl(): string | undefined {
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return app;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site;
  return undefined;
}
