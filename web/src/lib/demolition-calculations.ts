export type DemoType = "full" | "drywall" | "flooring" | "ceiling" | "selective";

export function contractorBags(sqFt: number): number {
  if (sqFt <= 0) return 0;
  return Math.ceil(sqFt / 50);
}

export function autoLabourDays(sqFt: number, stairs: boolean, hazmat: boolean): number {
  if (sqFt <= 0) return 0;
  let d = Math.ceil(sqFt / 400);
  if (stairs) d += 1;
  if (hazmat) d += 1;
  return d;
}

export type DumpsterYd = "10" | "14" | "20";

export function dumpsterRecommendationSqFt(sqFt: number): DumpsterYd {
  if (sqFt < 500) return "10";
  if (sqFt <= 1000) return "14";
  return "20";
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
