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

function getProductPrice(p: Record<string, unknown>) {
  const { price } = p;
  if (price == null) return "—";
  if (typeof price === "string" || typeof price === "number") return String(price);
  if (typeof price === "object") {
    const o = price as Record<string, unknown>;
    if (typeof o.raw === "string") return o.raw;
    if (typeof o.extracted === "number") return `$${o.extracted.toFixed(2)}`;
  }
  return "—";
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
    <div className="dim-bar" style={{ maxWidth: 480 }}>
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
        <ul
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 4,
          }}
        >
          {results.map((p, i) => (
            <li
              key={i}
              className="sc"
              style={{ padding: "12px 14px" }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>
                {getProductTitle(p)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ac2)",
                  marginTop: 4,
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                }}
              >
                {getProductPrice(p)}
              </div>
            </li>
          ))}
        </ul>
      ) : didSearch && !loading && !error ? (
        <p style={{ fontSize: 13, color: "var(--tx3)" }}>No results.</p>
      ) : null}
    </div>
  );
}
