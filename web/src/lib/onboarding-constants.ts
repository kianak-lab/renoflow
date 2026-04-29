/** Theme green for onboarding UI */
export const ONBOARDING_GREEN = "#3a8a3a";

export type OnboardingCountry = "CA" | "US";

export type RegionDef = { code: string; label: string; taxLabel: string; taxPercent: number };

export const CANADA_REGIONS: RegionDef[] = [
  { code: "ON", label: "Ontario", taxLabel: "HST 13%", taxPercent: 13 },
  { code: "BC", label: "British Columbia", taxLabel: "GST+PST 12%", taxPercent: 12 },
  { code: "AB", label: "Alberta", taxLabel: "GST 5%", taxPercent: 5 },
  { code: "QC", label: "Quebec", taxLabel: "QST 14.975%", taxPercent: 14.975 },
  { code: "MB", label: "Manitoba", taxLabel: "GST+PST 12%", taxPercent: 12 },
  { code: "SK", label: "Saskatchewan", taxLabel: "GST+PST 11%", taxPercent: 11 },
  { code: "NS", label: "Nova Scotia", taxLabel: "HST 15%", taxPercent: 15 },
  { code: "NB", label: "New Brunswick", taxLabel: "HST 15%", taxPercent: 15 },
];

export const US_REGIONS: RegionDef[] = [
  { code: "US-CA", label: "California", taxLabel: "Sales tax 7.25%", taxPercent: 7.25 },
  { code: "US-TX", label: "Texas", taxLabel: "Sales tax 6.25%", taxPercent: 6.25 },
  { code: "US-FL", label: "Florida", taxLabel: "Sales tax 6%", taxPercent: 6 },
  { code: "US-NY", label: "New York", taxLabel: "Sales tax 4%", taxPercent: 4 },
  { code: "US-WA", label: "Washington", taxLabel: "Sales tax 6.5%", taxPercent: 6.5 },
  { code: "US-IL", label: "Illinois", taxLabel: "Sales tax 6.25%", taxPercent: 6.25 },
  { code: "US-AZ", label: "Arizona", taxLabel: "Sales tax 5.6%", taxPercent: 5.6 },
  { code: "US-CO", label: "Colorado", taxLabel: "Sales tax 2.9%", taxPercent: 2.9 },
  { code: "US-OTHER", label: "Other", taxLabel: "Varies", taxPercent: 0 },
];

export type TradeRow = {
  id: string;
  label: string;
  icon: string;
  defaultChecked: boolean;
  group: string;
};

export const ONBOARDING_TRADES: TradeRow[] = [
  { group: "Structure", id: "demo", label: "Demolition", icon: "◆", defaultChecked: true },
  { group: "Structure", id: "framing", label: "Framing / Bulkhead", icon: "🏗", defaultChecked: true },
  { group: "Structure", id: "concrete", label: "Concrete", icon: "🧱", defaultChecked: false },
  { group: "Structure", id: "roofing", label: "Roofing", icon: "🏠", defaultChecked: false },
  { group: "Mechanical", id: "electrical", label: "Electrical", icon: "⚡", defaultChecked: true },
  { group: "Mechanical", id: "plumbing", label: "Plumbing", icon: "💧", defaultChecked: true },
  { group: "Mechanical", id: "hvac", label: "HVAC", icon: "❄️", defaultChecked: false },
  {
    group: "Mechanical",
    id: "low-voltage",
    label: "Low Voltage / Security / Commercial Door Hardware",
    icon: "📡",
    defaultChecked: false,
  },
  { group: "Shell", id: "insulation", label: "Insulation", icon: "🧶", defaultChecked: false },
  { group: "Shell", id: "drywall", label: "Drywall / Taping", icon: "🧱", defaultChecked: true },
  { group: "Finish", id: "tile", label: "Tile", icon: "🔵", defaultChecked: false },
  { group: "Finish", id: "flooring", label: "Flooring", icon: "🪵", defaultChecked: false },
  { group: "Finish", id: "painting", label: "Painting / Finishing", icon: "🎨", defaultChecked: true },
  { group: "Finish", id: "doors-trim", label: "Doors / Trim / Millwork", icon: "🪚", defaultChecked: false },
  { group: "Finish", id: "cabinets", label: "Cabinets & Tops", icon: "🚪", defaultChecked: false },
  { group: "Finish", id: "closets", label: "Closets", icon: "👕", defaultChecked: false },
  {
    group: "Exterior",
    id: "landscaping",
    label: "Landscaping / Deck / Fence / Sheds",
    icon: "🌿",
    defaultChecked: false,
  },
  { group: "Site", id: "cleaning", label: "Cleaning", icon: "🧹", defaultChecked: false },
];

export function regionFromSelection(country: OnboardingCountry, code: string): RegionDef | null {
  const list = country === "CA" ? CANADA_REGIONS : US_REGIONS;
  return list.find((r) => r.code === code) ?? null;
}
