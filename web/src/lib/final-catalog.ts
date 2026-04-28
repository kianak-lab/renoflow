/** Mirrors `TN` / `TB` in `final.html` for server-side room hydration. */

export const TN: Record<string, string> = {
  demo: "Demolition",
  framing: "Framing",
  concrete: "Concrete",
  roofing: "Roofing",
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  lowvolt: "Low voltage",
  security: "Security",
  comdoor: "Commercial door hardware",
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
  /* Demolition: use Next /trades/demolition + Supabase cached_products only — no legacy emoji lines. */
  demo: [],
  framing: [
    { id: "fhl", l: "👷 Framing labour", u: "hrs", p: 75 },
    { id: "frl1", l: "🪵 Studs 2x4", u: "ea", p: 4.5 },
    { id: "frl2", l: "🪵 Studs 2x6", u: "ea", p: 6.5 },
    { id: "frl3", l: "📏 Plates 2x4", u: "ea", p: 5 },
    { id: "frl4", l: "📏 Plates 2x6", u: "ea", p: 6 },
    { id: "frl5", l: "🪵 LVL beam", u: "ft", p: 12 },
    { id: "frl6", l: "🪵 Header material", u: "ft", p: 8 },
    { id: "frl7", l: "🧱 Blocking", u: "ea", p: 3 },
    { id: "frh1", l: "🪝 Joist hangers", u: "ea", p: 4.5 },
    { id: "frh2", l: "🌀 Hurricane ties", u: "ea", p: 3.2 },
    { id: "frh3", l: "🪛 Structural screws", u: "box", p: 45 },
    { id: "frh4", l: "🪵 Nail gun nails", u: "box", p: 38 },
    { id: "frh5", l: "🧪 Construction adhesive", u: "tube", p: 8 },
  ],
  concrete: [
    { id: "cf1", l: "🚛 Ready-mix (ordered)", u: "cy", p: 185 },
    { id: "cf2", l: "📦 60lb premix bags", u: "bag", p: 6.5 },
    { id: "cf3", l: "📦 80lb premix bags", u: "bag", p: 8.5 },
    { id: "cf4", l: "🔩 Rebar / mesh", u: "sqft", p: 1.2 },
    { id: "cf5", l: "👷 Concrete labour", u: "hrs", p: 95 },
  ],
  roofing: [
    { id: "rf1", l: "🔲 Architectural shingles", u: "sq", p: 125 },
    { id: "rf2", l: "📄 Synthetic underlayment", u: "roll", p: 95 },
    { id: "rf3", l: "📐 Drip edge", u: "lf", p: 4.2 },
    { id: "rf4", l: "👑 Ridge cap", u: "bundle", p: 48 },
    { id: "rf5", l: "🔩 Roofing nails", u: "lb", p: 5.5 },
    { id: "rf6", l: "👷 Roofing labour", u: "hrs", p: 88 },
  ],
  electrical: [
    { id: "el1", l: "👷 Electrician Labour", u: "hrs", p: 110 },
    { id: "el2", l: "🔌 Wiring 14/2", u: "roll", p: 85 },
    { id: "el3", l: "📦 Junction Boxes", u: "ea", p: 8 },
  ],
  plumbing: [
    { id: "pl2", l: "🔧 Supply Lines", u: "ea", p: 18 },
    { id: "pl4", l: "🛠 Tools", u: "ea", p: 0 },
  ],
  hvac: [
    { id: "hv3", l: "👷 HVAC labour", u: "hrs", p: 95 },
    { id: "hvr1", l: "🔧 Refrigerant line set", u: "ft", p: 8.5 },
    { id: "hvr2", l: "⚡ Electrical disconnect", u: "ea", p: 85 },
    { id: "hvr3", l: "🔌 Thermostat wire", u: "roll", p: 65 },
    { id: "hvr4", l: "💧 Condensate line", u: "ft", p: 4.2 },
    { id: "hvr5", l: "📦 Duct tape / mastic", u: "ea", p: 12 },
    { id: "hve1", l: "🔥 Furnace", u: "ea", p: 2200 },
    { id: "hve2", l: "❄ AC unit", u: "ea", p: 2800 },
    { id: "hve3", l: "♨ Heat pump", u: "ea", p: 3200 },
    { id: "hve4", l: "🌀 Air handler", u: "ea", p: 1400 },
    { id: "hve5", l: "🌬 HRV unit", u: "ea", p: 1100 },
    { id: "hve6", l: "💧 Humidifier", u: "ea", p: 650 },
    { id: "hvd1", l: "➡ Supply duct", u: "ft", p: 4.2 },
    { id: "hvd2", l: "⬅ Return duct", u: "ft", p: 3.8 },
    { id: "hvd3", l: "〰 Flex duct", u: "ft", p: 2.2 },
    { id: "hvd4", l: "🪧 Registers", u: "ea", p: 45 },
    { id: "hvd5", l: "⬛ Return grilles", u: "ea", p: 38 },
    { id: "hvd6", l: "⬛ Plenum box", u: "ea", p: 120 },
  ],
  lowvolt: [
    { id: "lhl", l: "👷 Low-voltage labour", u: "hrs", p: 95 },
    { id: "lvc1", l: "🌐 Cat6 outdoor", u: "ft", p: 3.8 },
    { id: "lvc2", l: "🔥 Cat6 plenum", u: "ft", p: 3.2 },
    { id: "lvc3", l: "📡 Cat6 non-plenum", u: "ft", p: 2.6 },
    { id: "lvc4", l: "📡 Coax RG6", u: "ft", p: 1.8 },
    { id: "lvc5", l: "🖥 HDMI cable", u: "ft", p: 4.5 },
    { id: "lvc6", l: "🔊 Speaker wire", u: "ft", p: 2.1 },
    { id: "lve1", l: "🔌 Patch panel", u: "ea", p: 95 },
    { id: "lve2", l: "🌐 Network switch", u: "ea", p: 180 },
    { id: "lve3", l: "🛜 Wireless AP", u: "ea", p: 220 },
    { id: "lve4", l: "🔀 HDMI to RJ45 adapter", u: "ea", p: 65 },
    { id: "lve5", l: "🖥 Monitor", u: "ea", p: 280 },
    { id: "lvp1", l: "🧱 PVC conduit", u: "ft", p: 2.2 },
    { id: "lvp2", l: "🪝 PVC connectors", u: "ea", p: 4.5 },
    { id: "lvp3", l: "⬛ PVC boxes", u: "ea", p: 12 },
    { id: "lvp4", l: "📷 Camera back box", u: "ea", p: 28 },
  ],
  security: [
    { id: "shl", l: "👷 Security labour", u: "hrs", p: 95 },
    { id: "sca1", l: "🎥 Interior camera", u: "ea", p: 180 },
    { id: "sca2", l: "🎥 Exterior camera", u: "ea", p: 220 },
    { id: "sca3", l: "🎥 PTZ camera", u: "ea", p: 1200 },
    { id: "sca4", l: "🚪 Doorbell camera", u: "ea", p: 150 },
    { id: "ses1", l: "📼 NVR unit", u: "ea", p: 450 },
    { id: "ses2", l: "🔌 PoE switch", u: "ea", p: 320 },
    { id: "ses3", l: "💾 Hard drive", u: "ea", p: 120 },
    { id: "ses4", l: "🖥 Monitor", u: "ea", p: 280 },
    { id: "sea1", l: "🧲 Mag lock", u: "ea", p: 180 },
    { id: "sea2", l: "💳 Card reader", u: "ea", p: 145 },
    { id: "sea3", l: "⏹ Exit button", u: "ea", p: 45 },
    { id: "sea4", l: "🎛 Access controller", u: "ea", p: 890 },
    { id: "sea5", l: "🗝 Key fobs", u: "ea", p: 8 },
  ],
  comdoor: [
    { id: "cd1", l: "🚪 Door closers", u: "ea", p: 85 },
    { id: "cd2", l: "🚪 Exit devices", u: "ea", p: 420 },
    { id: "cd3", l: "📎 Hinges", u: "ea", p: 28 },
    { id: "cd4", l: "🔐 Locksets", u: "ea", p: 180 },
    { id: "cd5", l: "🛑 Door stops", u: "ea", p: 12 },
    { id: "cd6", l: "👷 Hardware labour", u: "hrs", p: 95 },
  ],
  insulation: [
    { id: "in3", l: "👷 Insulation labour", u: "hrs", p: 55 },
    { id: "inb1", l: "🧱 R-14 batt", u: "bag", p: 38 },
    { id: "inb2", l: "🧱 R-20 batt", u: "bag", p: 44 },
    { id: "inb3", l: "🧱 R-22 batt", u: "bag", p: 48 },
    { id: "inb4", l: "🧱 R-28 batt", u: "bag", p: 56 },
    { id: "isf1", l: "💨 Open cell spray", u: "sqft", p: 1.2 },
    { id: "isf2", l: "🧱 Closed cell spray", u: "sqft", p: 2.8 },
    { id: "ird1", l: "⬛ 1 inch rigid", u: "sheet", p: 32 },
    { id: "ird2", l: "⬛ 2 inch rigid", u: "sheet", p: 48 },
  ],
  drywall: [
    { id: "dwr1", l: "⬜ Drywall 1/2 inch", u: "sheet", p: 18 },
    { id: "dwr2", l: "⬜ Drywall 5/8 inch", u: "sheet", p: 22 },
    { id: "dwr3", l: "🟦 Moisture resistant", u: "sheet", p: 28 },
    { id: "dwr4", l: "🔥 Fire rated", u: "sheet", p: 32 },
    { id: "dwr5", l: "📐 Corner bead", u: "ft", p: 2.1 },
    { id: "dwr6", l: "🪛 Drywall screws", u: "box", p: 28 },
    { id: "dwr7", l: "🪣 Joint compound", u: "pail", p: 32 },
    { id: "dwr8", l: "🎞 Mesh tape", u: "roll", p: 14 },
    { id: "dwr9", l: "🎞 Paper tape", u: "roll", p: 12 },
    { id: "dwf1", l: "🫙 Primer", u: "gallon", p: 32 },
    { id: "dwf2", l: "🪵 Sandpaper", u: "pack", p: 8 },
  ],
  tile: [
    { id: "tih", l: "👷 Tile labour", u: "sqft", p: 12 },
    { id: "tif1", l: "🔲 Floor tile", u: "sqft", p: 6 },
    { id: "tif2", l: "🟫 Wall tile", u: "sqft", p: 8 },
    { id: "tif3", l: "🧩 Mosaic tile", u: "sqft", p: 14 },
    { id: "tif4", l: "🚇 Subway tile", u: "sqft", p: 9 },
    { id: "tif5", l: "⬜ Large format tile", u: "sqft", p: 11 },
    { id: "tis1", l: "🪣 Thinset", u: "bag", p: 28 },
    { id: "tis2", l: "🪣 Grout", u: "bag", p: 32 },
    { id: "tis3", l: "⬛ Tile spacers", u: "bag", p: 12 },
    { id: "tis4", l: "⬛ Backer board", u: "sheet", p: 14 },
    { id: "tis5", l: "🛡 Waterproofing membrane", u: "sqft", p: 4.5 },
    { id: "tit1", l: "📏 Tile edging", u: "ft", p: 6 },
    { id: "tit2", l: "📐 Schluter strip", u: "ft", p: 8.5 },
    { id: "tit3", l: "🧪 Caulking", u: "tube", p: 6 },
  ],
  flooring: [
    { id: "fll", l: "👷 Flooring labour", u: "sqft", p: 4 },
    { id: "flm1", l: "🪵 Hardwood", u: "sqft", p: 8 },
    { id: "flm2", l: "🪵 Engineered hardwood", u: "sqft", p: 7 },
    { id: "flm3", l: "🪵 Laminate", u: "sqft", p: 3.5 },
    { id: "flm4", l: "⬛ LVP", u: "sqft", p: 4.2 },
    { id: "flm5", l: "🔲 Tile", u: "sqft", p: 5.5 },
    { id: "flm6", l: "🧶 Carpet", u: "sqft", p: 3 },
    { id: "flu1", l: "🧽 Foam underlay", u: "sqft", p: 0.6 },
    { id: "flu2", l: "🧻 Moisture barrier", u: "sqft", p: 0.4 },
    { id: "flu3", l: "🪵 Cork underlay", u: "sqft", p: 1.1 },
    { id: "fli1", l: "🪛 Flooring nails", u: "box", p: 38 },
    { id: "fli2", l: "🧪 Adhesive", u: "gallon", p: 45 },
    { id: "fli3", l: "➖ Transition strips", u: "ea", p: 18 },
    { id: "fli4", l: "📏 Baseboards", u: "ft", p: 3.2 },
    { id: "fli5", l: "〰 Quarter round", u: "ft", p: 2.4 },
  ],
  painting: [
    { id: "pah", l: "👷 Paint labour", u: "hrs", p: 55 },
    { id: "pnt1", l: "🪣 Interior paint", u: "gallon", p: 58 },
    { id: "pnt2", l: "🪣 Exterior paint", u: "gallon", p: 64 },
    { id: "pnt3", l: "🫙 Primer", u: "gallon", p: 42 },
    { id: "pnt4", l: "🪣 Ceiling paint", u: "gallon", p: 48 },
    { id: "pnt5", l: "🪣 Trim paint", u: "gallon", p: 52 },
    { id: "sup1", l: "🎨 Roller covers", u: "ea", p: 6 },
    { id: "sup2", l: "🖌 Paint brushes", u: "ea", p: 12 },
    { id: "sup3", l: "🧻 Painter tape", u: "roll", p: 8.5 },
    { id: "sup4", l: "🗂 Drop sheets", u: "ea", p: 14 },
    { id: "sup5", l: "🪵 Sandpaper", u: "pack", p: 8 },
    { id: "sup6", l: "🧪 Caulking", u: "tube", p: 5.5 },
  ],
  trim: [
    { id: "trl", l: "👷 Trim & millwork labour", u: "hrs", p: 65 },
    { id: "trb1", l: "📏 Baseboard", u: "ft", p: 2.5 },
    { id: "trb2", l: "🚪 Door casing", u: "ft", p: 2.8 },
    { id: "trb3", l: "🪟 Window casing", u: "ft", p: 2.7 },
    { id: "trb4", l: "👑 Crown moulding", u: "ft", p: 4.5 },
    { id: "trb5", l: "➖ Chair rail", u: "ft", p: 3.2 },
    { id: "trb6", l: "⬛ Wainscoting", u: "sqft", p: 6.5 },
    { id: "trd1", l: "🚪 Interior door", u: "ea", p: 380 },
    { id: "trd2", l: "🚪 Exterior door", u: "ea", p: 1200 },
    { id: "trd3", l: "🚪 Pocket door", u: "ea", p: 450 },
    { id: "trd4", l: "🚪 Barn door", u: "ea", p: 650 },
    { id: "trh1", l: "🪝 Door hinges", u: "set", p: 28 },
    { id: "trh2", l: "🚪 Door handles", u: "ea", p: 45 },
    { id: "trh3", l: "⏹ Door stops", u: "ea", p: 5 },
    { id: "trh4", l: "⏱ Closers", u: "ea", p: 85 },
  ],
  cabinets: [
    { id: "cah", l: "👷 Cabinet install labour", u: "hrs", p: 75 },
    { id: "cb1", l: "🗄 Upper cabinets", u: "ln ft", p: 280 },
    { id: "cb2", l: "🗄 Lower cabinets", u: "ln ft", p: 320 },
    { id: "cb3", l: "🗄 Tall cabinets", u: "ea", p: 1200 },
    { id: "cb4", l: "🗄 Island cabinets", u: "ln ft", p: 300 },
    { id: "cx1", l: "⬜ Quartz", u: "sqft", p: 75 },
    { id: "cx2", l: "⬜ Granite", u: "sqft", p: 65 },
    { id: "cx3", l: "⬜ Laminate", u: "sqft", p: 32 },
    { id: "cx4", l: "🪵 Butcher block", u: "sqft", p: 45 },
    { id: "ch1", l: "🪝 Cabinet handles", u: "ea", p: 8.5 },
    { id: "ch2", l: "🪝 Cabinet hinges", u: "ea", p: 6.5 },
    { id: "ch3", l: "🗃 Drawer slides", u: "ea", p: 24 },
    { id: "ch4", l: "⏹ Soft close hinges", u: "ea", p: 9 },
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
