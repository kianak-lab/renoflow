/**
 * Shared helpers for scripts that call /api/homedepot and insert into cached_products.
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.join(__dirname, ".."));

export const SEED_BASE_URL = (
  process.env.SEED_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

export const DEFAULT_DELAY_MS = 500;

export type ApiProduct = Record<string, unknown>;

export function labelToSearchTerm(label: string): string {
  const q = label
    .replace(/[^\p{L}\p{N}\s\-+&,./%']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q.length > 0 ? q : "material";
}

function getTitle(p: ApiProduct): string {
  if (typeof p.title === "string" && p.title.trim()) return p.title.trim();
  if (typeof p.name === "string" && p.name.trim()) return p.name.trim();
  return "";
}

function getBrand(p: ApiProduct): string | null {
  const b = p.brand;
  if (typeof b === "string" && b.trim()) return b.trim();
  if (b && typeof b === "object") {
    const n = (b as Record<string, unknown>).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return null;
}

function getThumbnail(p: ApiProduct): string | null {
  const t = p.thumbnail;
  if (typeof t === "string" && t.trim()) return t.trim();
  const th = p.thumbnails;
  if (Array.isArray(th) && th[0] != null) {
    const row = th[0] as unknown;
    if (Array.isArray(row) && typeof row[0] === "string") return row[0].trim();
    if (typeof row === "string") return row.trim();
  }
  return null;
}

function getPriceText(p: ApiProduct): string {
  const unit =
    typeof p.unit === "string" && p.unit.trim() ? p.unit.trim() : "each";
  const pr = p.price;
  if (typeof pr === "number" && !Number.isNaN(pr)) {
    return `$${pr.toFixed(2)} / ${unit}`;
  }
  if (typeof pr === "string" && pr.trim()) {
    return pr.includes("/") ? pr : `${pr} / ${unit}`;
  }
  if (pr && typeof pr === "object") {
    const o = pr as Record<string, unknown>;
    if (typeof o.raw === "string" && o.raw.trim()) {
      return o.raw.includes("/") ? o.raw : `${o.raw} / ${unit}`;
    }
    if (typeof o.extracted === "number") {
      return `$${o.extracted.toFixed(2)} / ${unit}`;
    }
  }
  return "";
}

function getModel(p: ApiProduct): string | null {
  const m = p.model_number;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

function getSku(p: ApiProduct): string | null {
  const v = p.product_id ?? p.store_sku_number ?? p.sku;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function toCachedProductInserts(
  trade: string,
  subsection: string,
  searchTerm: string,
  products: ApiProduct[],
) {
  const fetchedAt = new Date().toISOString();
  return products.map((p) => ({
    trade,
    subsection,
    search_term: searchTerm,
    title: getTitle(p) || searchTerm,
    brand: getBrand(p),
    thumbnail: getThumbnail(p),
    price: getPriceText(p) || "—",
    model_number: getModel(p),
    sku: getSku(p),
    fetched_at: fetchedAt,
  }));
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchTopTwo(q: string): Promise<ApiProduct[]> {
  const key = process.env.HOMEDEPOT_INTERNAL_KEY?.trim();
  if (!key) {
    throw new Error(
      "HOMEDEPOT_INTERNAL_KEY is missing — add it to web/.env.local for seed scripts to call /api/homedepot.",
    );
  }
  const url = new URL("/api/homedepot", SEED_BASE_URL);
  url.searchParams.set("q", q);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.slice(0, 2) as ApiProduct[];
}
