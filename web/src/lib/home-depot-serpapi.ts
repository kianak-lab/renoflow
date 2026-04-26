/**
 * Server-only Home Depot product fetch via SerpAPI.
 * Call only from seed tooling, /api/homedepot (internal key), or explicit refresh route.
 */
export async function fetchHomeDepotSerpProducts(
  query: string,
): Promise<Record<string, unknown>[]> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) return [];
  const q = (query || "").trim();
  if (!q) return [];
  const res = await fetch(
    `https://serpapi.com/search?engine=home_depot&q=${encodeURIComponent(q)}&country=ca&api_key=${key}`,
  );
  const data = (await res.json()) as { products?: unknown };
  if (!Array.isArray(data.products)) return [];
  return data.products as Record<string, unknown>[];
}
