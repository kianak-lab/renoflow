/** Mirrors `TN` / `TB` in `final.html` for server-side room hydration. */

export const TN: Record<string, string> = {
  demo: "Demolition",
  framing: "Framing",
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  lowvolt: "Low voltage",
  insulation: "Insulation",
  drywall: "Drywall",
  tile: "Tile",
  flooring: "Flooring",
  painting: "Painting",
  trim: "Trim & Millwork",
  cabinets: "Cabinets & tops",
  closets: "Closets",
  finishing: "Finishing",
};

export type CatalogItem = { id: string; l: string; u: string; p: number };

export const TB: Record<string, CatalogItem[]> = {
  demo: [
    { id: "d1", l: "👷 Demo Labour", u: "hrs", p: 65 },
    { id: "d2", l: "🗑 Disposal Bin", u: "load", p: 350 },
    { id: "d3", l: "📋 Permit", u: "flat", p: 0 },
  ],
  framing: [
    { id: "fr1", l: "🪵 Studs 2x4", u: "stud", p: 4.5 },
    { id: "fr2", l: "🪵 Studs 2x6", u: "stud", p: 6.5 },
    { id: "fr3", l: "📏 Plates 2x4", u: "ea", p: 5 },
    { id: "fr4", l: "👷 Framing Labour", u: "hrs", p: 75 },
  ],
  electrical: [
    { id: "el1", l: "👷 Electrician Labour", u: "hrs", p: 110 },
    { id: "el2", l: "🔌 Wiring 14/2", u: "roll", p: 85 },
    { id: "el3", l: "📦 Junction Boxes", u: "ea", p: 8 },
  ],
  plumbing: [
    { id: "pl1", l: "👷 Plumber Labour", u: "hrs", p: 120 },
    { id: "pl2", l: "🔧 Supply Lines", u: "ea", p: 18 },
  ],
  hvac: [
    { id: "hv1", l: "🌀 Ductwork", u: "ft", p: 12 },
    { id: "hv2", l: "🔲 Registers", u: "ea", p: 45 },
    { id: "hv3", l: "👷 HVAC Labour", u: "hrs", p: 95 },
  ],
  lowvolt: [
    { id: "lv1", l: "👷 Low-voltage labour", u: "hrs", p: 95 },
    { id: "lv2", l: "📡 Data / coax", u: "ft", p: 3.5 },
    { id: "lv3", l: "🔊 Pre-wire points", u: "ea", p: 85 },
    { id: "lv4", l: "🌐 Cat 6 outdoor cable", u: "ft", p: 3.8 },
    { id: "lv5", l: "🔥 Cat 6 plenum (fire rated)", u: "ft", p: 3.2 },
    { id: "lv6", l: "📡 Cat 6 non-plenum", u: "ft", p: 2.6 },
    { id: "lv7", l: "🔌 Patch panel", u: "ea", p: 95 },
    { id: "lv8", l: "📷 Camera exterior back box", u: "ea", p: 28 },
    { id: "lv9", l: "🧱 PVC pipe", u: "ft", p: 2.2 },
    { id: "lv10", l: "🔩 PVC connectors", u: "ea", p: 4.5 },
    { id: "lv11", l: "📦 PVC boxes", u: "ea", p: 12 },
    { id: "lv12", l: "🔀 HDMI to RJ45 adapter", u: "ea", p: 65 },
    { id: "lv13", l: "🖥 Monitor", u: "ea", p: 280 },
  ],
  insulation: [
    { id: "in1", l: "🧱 Batt Insulation", u: "bag", p: 42 },
    { id: "in2", l: "💨 Spray Foam", u: "sqft", p: 2.8 },
    { id: "in3", l: "👷 Labour", u: "hrs", p: 55 },
  ],
  drywall: [
    { id: "dw1", l: "⬜ Drywall 4x8", u: "sheet", p: 18 },
    { id: "dw2", l: "🟦 Moisture Board 4x8", u: "sheet", p: 28 },
    { id: "dw3", l: "🪣 Joint Compound", u: "pail", p: 28 },
    { id: "dw6", l: "🎞 Drywall Tape", u: "roll", p: 12 },
    { id: "dw4", l: "👷 Drywall Labour", u: "hrs", p: 65 },
    { id: "dw5", l: "🖌 Finishing Labour", u: "hrs", p: 70 },
  ],
  tile: [
    { id: "ti1", l: "🔲 Floor Tile", u: "sqft", p: 6 },
    { id: "ti2", l: "🟫 Wall Tile", u: "sqft", p: 8 },
    { id: "ti3", l: "🛡 Membrane", u: "sqft", p: 4 },
    { id: "ti4", l: "📐 Schluter", u: "ft", p: 8 },
    { id: "ti5", l: "👷 Tile Labour", u: "sqft", p: 12 },
  ],
  flooring: [
    { id: "fl1", l: "🪵 Hardwood / LVP", u: "sqft", p: 6 },
    { id: "fl2", l: "📄 Underlay", u: "sqft", p: 1.2 },
    { id: "fl3", l: "👷 Labour", u: "sqft", p: 4 },
  ],
  painting: [
    { id: "pa1", l: "🪣 Wall Paint", u: "can", p: 72 },
    { id: "pa2", l: "🪣 Ceiling Paint", u: "can", p: 65 },
    { id: "pa3", l: "🫙 Primer", u: "can", p: 55 },
    { id: "pa4", l: "👷 Labour", u: "hrs", p: 55 },
  ],
  trim: [
    { id: "tr1", l: "📏 Baseboard", u: "ft", p: 2.5 },
    { id: "tr2", l: "🚪 Door Casing", u: "ft", p: 2.8 },
    { id: "tr3", l: "👑 Crown Moulding", u: "ft", p: 4.5 },
    { id: "tr4", l: "🚪 Interior Door+Frame", u: "ea", p: 380 },
    { id: "tr5", l: "👷 Trim Labour", u: "hrs", p: 65 },
  ],
  cabinets: [
    { id: "ca1", l: "👷 Cabinet Install Labour", u: "hrs", p: 75 },
    { id: "ca2", l: "⬜ Countertop (supply)", u: "sqft", p: 85 },
  ],
  closets: [
    { id: "cl1", l: "👷 Closet install labour", u: "hrs", p: 72 },
    { id: "cl2", l: "📐 Wire / melamine", u: "ln ft", p: 42 },
    { id: "cl3", l: "🚪 Bifold / bypass doors", u: "ea", p: 240 },
  ],
  finishing: [
    { id: "fn1", l: "👷 Punch / detail labour", u: "hrs", p: 62 },
    { id: "fn2", l: "🔧 Hardware / accessories", u: "ea", p: 28 },
    { id: "fn3", l: "✨ Final touch-ups", u: "hrs", p: 58 },
  ],
};

const TRADE_LABEL: Record<string, string> = { ...TN };

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function rowStr(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function tradeUuidToSlug(
  tradeRows: Record<string, unknown>[],
  tradeId: string,
): string | null {
  const tid = tradeId.trim();
  for (const raw of tradeRows) {
    const id = rowStr(raw, ["id"]);
    if (!id || id !== tid) continue;
    const slug = rowStr(raw, ["slug", "code", "key"]);
    if (slug) return slug.trim().toLowerCase();
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name) {
      for (const [sl, lab] of Object.entries(TRADE_LABEL)) {
        if (name.toLowerCase() === lab.toLowerCase() || normKey(name) === normKey(lab)) {
          return sl;
        }
      }
    }
  }
  return null;
}
