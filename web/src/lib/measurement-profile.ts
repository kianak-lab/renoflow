export type MeasurementUnits = "imperial" | "metric";

export function parseMeasurementUnits(raw: string | null | undefined): MeasurementUnits {
  return raw === "metric" ? "metric" : "imperial";
}

const FT_PER_M = 3.280839895;

export function sqFtToSqM(sqft: number): number {
  return (Number(sqft) || 0) * 0.09290304;
}

export function ftToM(ft: number): number {
  return (Number(ft) || 0) / FT_PER_M;
}

export function formatAreaFromSqFt(sqft: number, units: MeasurementUnits): string {
  const n = Number(sqft) || 0;
  if (units === "metric") return `${Math.round(sqFtToSqM(n) * 10) / 10} m²`;
  return `${Math.round(n)} sq ft`;
}

export function formatLengthFromFt(ft: number, units: MeasurementUnits): string {
  const n = Number(ft) || 0;
  if (units === "metric") return `${Math.round(ftToM(n) * 100) / 100} m`;
  return `${Math.round(n)} ft`;
}
