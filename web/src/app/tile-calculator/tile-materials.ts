import type { FloorSub } from "./tile-types";

export type CachedProduct = {
  id: string;
  thumbnail: string | null;
  brand: string | null;
  title: string | null;
  price: string | null;
  trade: string | null;
  subsection: string | null;
};

export type CalcSnapshot = {
  wallTilesWaste: number;
  wallSqFt: number;
  flTiles: number;
  flSqFt: number;
  ceilTiles: number;
  ceilSqFt: number;
  hasCeil: boolean;
  thinsetBags: number;
  groutBags: number;
  schluterFt: number;
  floorSub: FloorSub;
  hasHeat: boolean;
  hasSteam: boolean;
};

function hay(p: CachedProduct): string {
  return [p.title, p.subsection, p.brand]
    .filter((x): x is string => x != null && String(x).trim() !== "")
    .join(" ")
    .toLowerCase();
}

type LineDef = {
  getQty: (c: CalcSnapshot) => string | null;
  fallback: { name: string; icon: string; desc: string };
  /** prefer subsection containing this (case-insensitive) */
  subsectionHint?: string;
  /** at least one group: every term in the group must appear in hay() */
  matchGroups: string[][];
  /** skip product if hay includes any of these (e.g. "steam" for in-floor t-stat) */
  excludeIfHayIncludes?: string[];
};

const LINES: LineDef[] = [
  {
    getQty: (c) => `${c.wallTilesWaste} tiles`,
    fallback: { name: "Wall tile", icon: "🔲", desc: "Calculated — 10% waste" },
    subsectionHint: "wall",
    matchGroups: [
      ["wall", "tile"],
      ["subway", "tile"],
      ["wall", "subway"],
      ["ceramic", "wall"],
    ],
  },
  {
    getQty: (c) => `${c.flTiles} tiles`,
    fallback: { name: "Floor tile", icon: "🔲", desc: "Calculated — 10% waste" },
    subsectionHint: "floor",
    matchGroups: [
      ["floor", "tile"],
      ["porcelain", "tile"],
      ["floor", "porcelain"],
    ],
  },
  {
    getQty: (c) => (c.hasCeil ? `${c.ceilTiles} tiles` : null),
    fallback: { name: "Ceiling tile", icon: "🔲", desc: "Calculated — 10% waste" },
    subsectionHint: "ceiling",
    matchGroups: [["ceiling"], ["ceiling", "tile"]],
  },
  {
    getQty: (c) => `${c.thinsetBags} bags`,
    fallback: { name: "Thinset bags", icon: "🪣", desc: "50 lb — walls, floor, ceiling" },
    subsectionHint: "thinset",
    matchGroups: [
      ["thinset"],
      ["mortar", "set"],
      ["mortar mix"],
    ],
  },
  {
    getQty: (c) => `${c.groutBags} bags`,
    fallback: { name: "Grout bags", icon: "🪣", desc: "10 lb — all joints" },
    subsectionHint: "grout",
    matchGroups: [["grout"]],
  },
  {
    getQty: (c) => `${c.schluterFt} ft`,
    fallback: { name: "Schluter strip", icon: "📏", desc: "All exposed tile edges" },
    subsectionHint: "schluter",
    matchGroups: [
      ["schluter", "strip"],
      ["schluter", "jolly"],
      ["jolly", "edge"],
      ["schluter"],
      ["j-trim"],
    ],
  },
  {
    getQty: (c) => `${Math.ceil(c.wallSqFt + c.flSqFt)} sq ft`,
    fallback: { name: "Waterproofing", icon: "🛡", desc: "RedGard or KERDI coverage" },
    subsectionHint: "waterproof",
    matchGroups: [
      ["waterproof"],
      ["kerdi", "membrane"],
      ["redgard"],
    ],
  },
  {
    getQty: (c) => (c.floorSub === "ditra" ? `${Math.ceil(c.flSqFt)} sq ft` : null),
    fallback: { name: "Schluter Ditra mat", icon: "🟧", desc: "Floor uncoupling membrane" },
    subsectionHint: "ditra",
    matchGroups: [["ditra"], ["uncoupl"]],
  },
  {
    getQty: (c) => (c.floorSub === "scratch" ? `${Math.ceil(c.flSqFt / 15)} bags` : null),
    fallback: { name: "Portland / sand mix", icon: "🪣", desc: "Scratch coat — 50 lb bags" },
    matchGroups: [
      ["portland", "sand"],
      ["scratch"],
      ["mason", "mix"],
    ],
  },
  {
    getQty: (c) => (c.hasHeat ? `${Math.ceil(c.flSqFt)} sq ft` : null),
    fallback: { name: "Electric heat mat", icon: "🔥", desc: "Under tile — match floor sq ft" },
    matchGroups: [
      ["heat", "mat"],
      ["cable", "heat"],
      ["radiant", "mat"],
    ],
  },
  {
    getQty: (c) => (c.hasHeat ? "1 unit" : null),
    fallback: { name: "Thermostat", icon: "🌡", desc: "In-floor heat controller" },
    excludeIfHayIncludes: ["steam", "fog", "baffle"],
    matchGroups: [
      ["in-floor", "thermostat"],
      ["in floor", "thermostat"],
      ["floor", "thermostat", "heat"],
      ["thermostat", "heat"],
    ],
  },
  {
    getQty: (c) => (c.hasHeat ? `${Math.ceil(c.flSqFt / 40)} bags` : null),
    fallback: { name: "Self-leveler", icon: "🧪", desc: "Over heat mat before tile" },
    matchGroups: [["self", "level"], ["leveler"], ["self-levell"]],
  },
  {
    getQty: (c) => (c.hasSteam ? "1 unit" : null),
    fallback: { name: "Steam generator", icon: "💨", desc: "2–7 kW depending on shower size" },
    matchGroups: [
      ["steam", "generat"],
      ["steamist"],
      ["mr.", "steam"],
    ],
  },
  {
    getQty: (c) => (c.hasSteam ? "1 unit" : null),
    fallback: { name: "Steam head", icon: "💨", desc: "Low on wall, away from door" },
    matchGroups: [
      ["steam", "head"],
      ["vapor", "outlet"],
    ],
  },
  {
    getQty: (c) => (c.hasSteam ? "1 unit" : null),
    fallback: { name: "Steam control", icon: "🎛", desc: "Digital controller" },
    matchGroups: [
      ["steam", "control"],
      ["aroma", "steam"],
    ],
  },
  {
    getQty: (c) => (c.hasSteam ? "as needed" : null),
    fallback: { name: "Blocking lumber 2x6", icon: "🪵", desc: "For steam generator mounting" },
    matchGroups: [["2x6"], ["framing", "lumber"]],
  },
  {
    getQty: () => "3 tubes",
    fallback: { name: "Silicone caulk", icon: "🧪", desc: "All corners and transitions" },
    matchGroups: [["silicone", "caulk"], ["silicone", "sealant"], ["caulk", "kitchen"]],
  },
  {
    getQty: () => "1 bottle",
    fallback: { name: "Grout sealer", icon: "🧪", desc: "After grout cures — 72h" },
    matchGroups: [["sealer", "grout"], ["sealer", "stone"], ["sealer", "grout sealer"]],
  },
];

function groupMatches(p: CachedProduct, groups: string[][]): boolean {
  const h = hay(p);
  return groups.some((g) => g.every((term) => h.includes(term.toLowerCase())));
}

function excluded(p: CachedProduct, def: LineDef): boolean {
  if (!def.excludeIfHayIncludes?.length) return false;
  const h = hay(p);
  return def.excludeIfHayIncludes.some((x) => h.includes(x.toLowerCase()));
}

function pickProduct(
  products: CachedProduct[],
  def: LineDef,
  used: Set<string>
): CachedProduct | null {
  const pool = products.filter(
    (p) => p.id && !used.has(p.id) && !excluded(p, def)
  );
  if (pool.length === 0) return null;

  if (def.subsectionHint) {
    const hint = def.subsectionHint.toLowerCase();
    const bySub = pool.find((p) => p.subsection && p.subsection.toLowerCase().includes(hint) && !excluded(p, def));
    if (bySub) return bySub;
  }

  for (const p of pool) {
    if (excluded(p, def)) continue;
    if (groupMatches(p, def.matchGroups)) return p;
  }

  const w = def.matchGroups[0]?.[0];
  if (w) {
    const t = w.toLowerCase();
    for (const p of pool) {
      if (excluded(p, def)) continue;
      if (hay(p).includes(t)) return p;
    }
  }
  return null;
}

export type ResolvedMaterialRow = {
  key: string;
  qty: string;
  product: CachedProduct | null;
  displayName: string;
  displayBrand: string;
  displayPrice: string;
  displayDesc: string;
  icon: string;
  matched: boolean;
};

export function buildResolvedMaterialRows(
  c: CalcSnapshot,
  products: CachedProduct[] | null
): ResolvedMaterialRow[] {
  if (!products || products.length === 0) {
    const rows: ResolvedMaterialRow[] = [];
    LINES.forEach((def, i) => {
      const qty = def.getQty(c);
      if (qty == null) return;
      rows.push({
        key: `f-${i}`,
        qty,
        product: null,
        displayName: def.fallback.name,
        displayBrand: "",
        displayPrice: "—",
        displayDesc: def.fallback.desc,
        icon: def.fallback.icon,
        matched: false,
      });
    });
    return rows;
  }

  const used = new Set<string>();
  const out: ResolvedMaterialRow[] = [];

  for (let i = 0; i < LINES.length; i++) {
    const def = LINES[i];
    const qty = def.getQty(c);
    if (qty == null) continue;

    const p = pickProduct(products, def, used);
    if (p) used.add(p.id);

    out.push({
      key: p?.id || `row-${i}`,
      qty,
      product: p,
      displayName: p?.title?.trim() || def.fallback.name,
      displayBrand: p?.brand?.trim() || "",
      displayPrice: p?.price != null && p.price !== "" ? String(p.price) : "—",
      displayDesc: def.fallback.desc,
      icon: def.fallback.icon,
      matched: !!p,
    });
  }
  return out;
}
