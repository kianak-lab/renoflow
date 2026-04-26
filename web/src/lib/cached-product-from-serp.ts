/**
 * Map a SerpAPI Home Depot product object to cached_products columns.
 */
export type SerpProduct = Record<string, unknown>;

export function serpProductToCachedColumns(p: SerpProduct, fetchedAt: string) {
  const title = getTitle(p);
  return {
    title: title || "—",
    brand: getBrand(p),
    thumbnail: getThumbnail(p),
    price: getPriceText(p) || "—",
    model_number: getModel(p),
    sku: getSku(p),
    fetched_at: fetchedAt,
  };
}

function getTitle(p: SerpProduct): string {
  if (typeof p.title === "string" && p.title.trim()) return p.title.trim();
  if (typeof p.name === "string" && p.name.trim()) return p.name.trim();
  return "";
}

function getBrand(p: SerpProduct): string | null {
  const b = p.brand;
  if (typeof b === "string" && b.trim()) return b.trim();
  if (b && typeof b === "object") {
    const n = (b as Record<string, unknown>).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return null;
}

function getThumbnail(p: SerpProduct): string | null {
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

function getPriceText(p: SerpProduct): string {
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

function getModel(p: SerpProduct): string | null {
  const m = p.model_number;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

function getSku(p: SerpProduct): string | null {
  const v = p.product_id ?? p.store_sku_number ?? p.sku;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}
