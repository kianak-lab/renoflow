/**
 * Seeds public.cached_products from the master material catalog (TB in final-catalog).
 * For each line item, calls your running app at SEED_BASE_URL + /api/homedepot,
 * takes the top 2 results, and inserts rows (requires SUPABASE_SERVICE_ROLE_KEY).
 *
 * Run from repo `web/`:  npm run seed:products
 * Prerequisites:  next dev (or start) on SEED_BASE_URL, SERPAPI_KEY on the server, migration applied.
 */

import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServiceClient } from "../src/lib/supabase-service";
import { TB, TN, type CatalogItem } from "../src/lib/final-catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.join(__dirname, ".."));

const SEED_BASE_URL = (
  process.env.SEED_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const DELAY_MS = 500;

function labelToSearchTerm(label: string): string {
  const q = label
    .replace(/[^\p{L}\p{N}\s\-+&,./%']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q.length > 0 ? q : "material";
}

type ApiProduct = Record<string, unknown>;

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

function buildMasterList(): { trade: string; subsection: string; searchTerm: string }[] {
  const out: { trade: string; subsection: string; searchTerm: string }[] = [];
  for (const [tradeId, items] of Object.entries(TB) as [string, CatalogItem[]][]) {
    const trade = TN[tradeId] ?? tradeId;
    for (const it of items) {
      out.push({
        trade,
        subsection: it.l,
        searchTerm: labelToSearchTerm(it.l),
      });
    }
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTopTwo(
  q: string,
): Promise<ApiProduct[]> {
  const url = new URL("/api/homedepot", SEED_BASE_URL);
  url.searchParams.set("q", q);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.slice(0, 2) as ApiProduct[];
}

async function main() {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load web/.env.local or set in shell.",
    );
    process.exit(1);
  }

  const rows = buildMasterList();
  console.log(
    `Seeding from ${rows.length} catalog lines → ${SEED_BASE_URL}/api/homedepot (delay ${DELAY_MS}ms between items)`,
  );

  let done = 0;
  for (const row of rows) {
    const label = `${row.trade} / ${row.subsection}`;
    try {
      const products = await fetchTopTwo(row.searchTerm);
      if (products.length === 0) {
        console.warn(`[${done + 1}/${rows.length}] No results:`, label);
      }
      const fetchedAt = new Date().toISOString();
      const inserts = products.map((p) => ({
        trade: row.trade,
        subsection: row.subsection,
        search_term: row.searchTerm,
        title: getTitle(p) || row.searchTerm,
        brand: getBrand(p),
        thumbnail: getThumbnail(p),
        price: getPriceText(p) || "—",
        model_number: getModel(p),
        sku: getSku(p),
        fetched_at: fetchedAt,
      }));
      if (inserts.length > 0) {
        const { error } = await supabase.from("cached_products").insert(inserts);
        if (error) throw error;
        console.log(
          `[${done + 1}/${rows.length}] OK ${inserts.length} row(s):`,
          label.slice(0, 80),
        );
      }
    } catch (e) {
      console.error(`[${done + 1}/${rows.length}] FAIL:`, label, e);
    }
    done += 1;
    if (done < rows.length) await sleep(DELAY_MS);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
