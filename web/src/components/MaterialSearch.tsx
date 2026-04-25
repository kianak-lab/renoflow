"use client";

import { useCallback, useState } from "react";

type Material = { name: string };

async function searchHomeDepot(material: Material) {
  const res = await fetch(`/api/homedepot?q=${encodeURIComponent(material.name)}`);
  const products = await res.json();
  return products.slice(0, 2);
}

function getProductTitle(p: Record<string, unknown>) {
  if (typeof p.title === "string") return p.title;
  if (typeof p.name === "string") return p.name;
  return "Untitled product";
}

function getThumbnailUrl(p: Record<string, unknown>): string | undefined {
  const t = p.thumbnail;
  if (typeof t === "string" && t.trim()) return t;
  const th = p.thumbnails;
  if (Array.isArray(th) && th[0] != null) {
    const row = th[0] as unknown;
    if (Array.isArray(row) && typeof row[0] === "string") return row[0];
    if (typeof row === "string") return row;
  }
  return undefined;
}

function getBrandName(p: Record<string, unknown>): string {
  const b = p.brand;
  if (typeof b === "string" && b.trim()) return b;
  if (b && typeof b === "object") {
    const n = (b as Record<string, unknown>).name;
    if (typeof n === "string" && n.trim()) return n;
  }
  return "";
}

function getModelSkuLine(p: Record<string, unknown>): string {
  const parts: string[] = [];
  const model = p.model_number;
  if (typeof model === "string" && model.trim()) parts.push(`Model # ${model}`);
  const sku = p.product_id ?? p.store_sku_number ?? p.sku;
  if (sku !== undefined && sku !== null && String(sku).trim() !== "") {
    parts.push(`SKU ${String(sku)}`);
  }
  return parts.join(" · ");
}

function getPriceDisplay(p: Record<string, unknown>): string {
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
    if (typeof o.raw === "string") {
      return o.raw.includes("/") ? o.raw : `${o.raw} / ${unit}`;
    }
    if (typeof o.extracted === "number") {
      return `$${o.extracted.toFixed(2)} / ${unit}`;
    }
  }
  return "—";
}

function getStockDisplay(p: Record<string, unknown>): {
  text: string;
  tone: "in" | "out" | "none";
} {
  const si = p.stock_information;
  if (si && typeof si === "object") {
    const g = (si as Record<string, unknown>).general_stock_status;
    if (typeof g === "string" && g.trim()) {
      const lower = g.toLowerCase();
      if (lower.includes("in stock")) {
        return { text: "In Stock", tone: "in" };
      }
      if (lower.includes("out")) {
        return { text: g.replace(/_/g, " "), tone: "out" };
      }
      return { text: g, tone: "out" };
    }
  }
  const av = p.availability;
  if (typeof av === "string" && av.trim()) {
    const lower = av.toLowerCase();
    if (lower.includes("in stock")) return { text: "In Stock", tone: "in" };
    return { text: av, tone: "out" };
  }
  return { text: "", tone: "none" };
}

export default function MaterialSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSearch, setDidSearch] = useState(false);

  const runSearch = useCallback(async () => {
    const name = query.trim();
    if (!name) {
      setResults([]);
      setError("Enter a search term.");
      setDidSearch(false);
      return;
    }
    setDidSearch(true);
    setLoading(true);
    setError(null);
    try {
      const items = await searchHomeDepot({ name });
      const list = Array.isArray(items) ? items : [];
      setResults(list as Record<string, unknown>[]);
    } catch {
      setError("Search failed. Try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div style={{ maxWidth: 480, padding: 24 }}>
      <div className="dim-t">Material search</div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="material-search-q">Search Home Depot (Canada)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            id="material-search-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="e.g. SPF stud 2x4"
            autoComplete="off"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            type="button"
            className="btn bp"
            onClick={() => void runSearch()}
            disabled={loading}
          >
            {loading ? "…" : "Search"}
          </button>
        </div>
      </div>
      {error ? (
        <p style={{ fontSize: 13, color: "var(--red)" }} role="alert">
          {error}
        </p>
      ) : null}
      {results.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {results.map((p, i) => {
            const thumbnail = getThumbnailUrl(p);
            const brand = getBrandName(p);
            const title = getProductTitle(p);
            const modelSku = getModelSkuLine(p);
            const priceLine = getPriceDisplay(p);
            const stock = getStockDisplay(p);
            return (
              <li key={i} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid var(--bd)",
                    borderRadius: 10,
                    padding: 14,
                    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt=""
                        width={80}
                        height={80}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 6,
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {brand ? (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--tx)",
                          }}
                        >
                          {brand}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: 1.35,
                          color: "var(--tx)",
                        }}
                      >
                        {title}
                      </div>
                      {modelSku ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--tx3)",
                            lineHeight: 1.4,
                          }}
                        >
                          {modelSku}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "var(--tx)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {priceLine}
                      </div>
                      {stock.tone !== "none" ? (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color:
                              stock.tone === "in" ? "#1a7f37" : "var(--tx3)",
                          }}
                        >
                          {stock.text}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 14,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Add to List
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : didSearch && !loading && !error ? (
        <p style={{ fontSize: 13, color: "var(--tx3)" }}>No results.</p>
      ) : null}
    </div>
  );
}
