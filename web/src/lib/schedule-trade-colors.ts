/** Calendar cell / card backgrounds (Site Clean schedule). */
export const SCHEDULE_TRADE_BG: Record<string, string> = {
  demo: "#fff8e1",
  plumbing: "#e3f2fd",
  electrical: "#fff3e0",
  tile: "#f3e5f5",
  framing: "#f5f5f5",
};

export const SCHEDULE_TRADE_DEFAULT_BG = "#f0f0f0";

/** Accent for status dots / chips on light backgrounds. */
export const SCHEDULE_TRADE_DOT: Record<string, string> = {
  demo: "#e65100",
  plumbing: "#1565c0",
  electrical: "#f57f17",
  tile: "#7b1fa2",
  framing: "#616161",
};

export function tradeScheduleBg(tradeId: string): string {
  const id = tradeId.trim().toLowerCase();
  return SCHEDULE_TRADE_BG[id] ?? SCHEDULE_TRADE_DEFAULT_BG;
}

export function tradeScheduleDot(tradeId: string): string {
  const id = tradeId.trim().toLowerCase();
  return SCHEDULE_TRADE_DOT[id] ?? "#666666";
}
