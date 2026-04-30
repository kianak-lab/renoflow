export type ProfileCurrency = "CAD" | "USD";

export function parseProfileCurrency(raw: string | null | undefined): ProfileCurrency {
  return raw === "USD" ? "USD" : "CAD";
}

/** Prefix style: "CAD $" / "USD $" per product copy */
export function formatMoneyWithCurrency(amount: number, currency: ProfileCurrency): string {
  const x = Math.round((Number(amount) || 0) * 100) / 100;
  const prefix = currency === "USD" ? "USD $" : "CAD $";
  const minFrac = x % 1 === 0 ? 0 : 2;
  return (
    prefix +
    x.toLocaleString("en-CA", {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: 2,
    })
  );
}
