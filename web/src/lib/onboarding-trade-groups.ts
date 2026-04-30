/** Exact 18 trades, grouped — ids match RenoFlow catalog / onboarding API */

export type TradeGroup = {
  category: string;
  trades: { id: string; label: string }[];
};

export const TRADE_GROUPS: TradeGroup[] = [
  {
    category: "Structure",
    trades: [
      { id: "demo", label: "Demolition" },
      { id: "framing", label: "Framing / Bulkhead" },
      { id: "concrete", label: "Concrete" },
      { id: "roofing", label: "Roofing" },
    ],
  },
  {
    category: "Mechanical",
    trades: [
      { id: "electrical", label: "Electrical" },
      { id: "plumbing", label: "Plumbing" },
      { id: "hvac", label: "HVAC" },
      {
        id: "low-voltage",
        label: "Low Voltage / Security / Commercial Door Hardware",
      },
    ],
  },
  {
    category: "Shell",
    trades: [
      { id: "insulation", label: "Insulation" },
      { id: "drywall", label: "Drywall / Taping" },
    ],
  },
  {
    category: "Finish",
    trades: [
      { id: "tile", label: "Tile" },
      { id: "flooring", label: "Flooring" },
      { id: "painting", label: "Painting / Finishing" },
      { id: "doors-trim", label: "Doors / Trim / Millwork" },
      { id: "cabinets", label: "Cabinets & Tops" },
      { id: "closets", label: "Closets" },
    ],
  },
  {
    category: "Exterior",
    trades: [
      { id: "landscaping", label: "Landscaping / Deck / Fence / Sheds" },
      { id: "cleaning", label: "Cleaning" },
    ],
  },
];

export const DEFAULT_TRADE_IDS = new Set([
  "demo",
  "framing",
  "electrical",
  "plumbing",
  "drywall",
  "painting",
]);
