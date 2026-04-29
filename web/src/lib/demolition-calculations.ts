/** Pure helpers for Demolition trade (V3 UI). */

export function formatMoney(n: number): string {
  const x = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: x % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(x);
}

export function parsePrice(p: string | number | null | undefined): number {
  if (p == null) return 0;
  if (typeof p === "number" && !Number.isNaN(p)) return p;
  const m = String(p).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : 0;
}

export type RoomDims = {
  L?: number;
  W?: number;
  H?: number;
  l?: number;
  w?: number;
  h?: number;
  len?: number;
  wid?: number;
  ceiling?: number;
};

export function floorSqFtFromDims(d: RoomDims | Record<string, unknown> | undefined): number {
  if (!d || typeof d !== "object") return 0;
  const o = d as Record<string, unknown>;
  const len = numFrom(o, ["L", "l", "len", "length"]);
  const wid = numFrom(o, ["W", "w", "wid", "width"]);
  if (len > 0 && wid > 0) return Math.round(len * wid * 10) / 10;
  const fl = numFrom(o, ["floorArea", "floor_area", "fl", "sqft", "sqFt", "area"]);
  return fl > 0 ? fl : 0;
}

export function ceilingFtFromDims(d: RoomDims | Record<string, unknown> | undefined): number {
  if (!d || typeof d !== "object") return 0;
  const o = d as Record<string, unknown>;
  return numFrom(o, ["H", "h", "ceiling", "ceil", "height"]);
}

function numFrom(o: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

export function formatDimsLine(d: RoomDims | Record<string, unknown> | undefined): string {
  if (!d || typeof d !== "object") return "—";
  const o = d as Record<string, unknown>;
  const len = numFrom(o, ["L", "l", "len", "length"]);
  const wid = numFrom(o, ["W", "w", "wid", "width"]);
  const h = numFrom(o, ["H", "h", "ceiling", "ceil", "height"]);
  if (len > 0 && wid > 0 && h > 0) {
    return `${fmtFt(len)} × ${fmtFt(wid)} × ${fmtFt(h)}`;
  }
  if (len > 0 && wid > 0) return `${fmtFt(len)} × ${fmtFt(wid)}`;
  return "—";
}

function fmtFt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function totalLabourHours(workers: Array<{ days: number }>): number {
  let s = 0;
  for (const w of workers) s += Math.max(0, w.days || 0) * 8;
  return s;
}
