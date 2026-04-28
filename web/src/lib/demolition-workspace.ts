import type { DemoType } from "@/lib/demolition-calculations";
import { autoLabourDays } from "@/lib/demolition-calculations";

export type CachedProductRow = {
  id: string;
  thumbnail: string | null;
  brand: string | null;
  title: string | null;
  price: string | number | null;
  trade: string | null;
  subsection: string | null;
};

export type DemolitionV2State = {
  demoType: DemoType;
  roomCount: number;
  sqFt: number;
  ceilingFt: number;
  hazmat: boolean;
  exteriorDumpster: boolean;
  dumpsterSize: "10" | "14" | "20";
  stairs: boolean;
  labourDays: number;
  labourRate: number;
  workers: number;
  markupPct: number;
  materialQty: Record<string, number>;
  labourDaysTouched: boolean;
};

const DEFAULT_STATE: DemolitionV2State = {
  demoType: "full",
  roomCount: 1,
  sqFt: 0,
  ceilingFt: 8,
  hazmat: false,
  exteriorDumpster: false,
  dumpsterSize: "10",
  stairs: false,
  labourDays: 0,
  labourRate: 650,
  workers: 1,
  markupPct: 20,
  materialQty: {},
  labourDaysTouched: false,
};

type TradeShape = {
  id?: string;
  days?: number;
  daysCustom?: boolean;
  labour?: { mode?: string; rate?: number; qty?: number; jobPrice?: number };
  catPick?: Record<
    string,
    { q?: number; m?: number; sup?: number; title?: string; brand?: string; priceLabel?: string; thumb?: string }
  >;
  rfDemolition?: Partial<DemolitionV2State>;
};

type WorkspaceShape = {
  rooms?: Array<{
    trades?: TradeShape[];
  }>;
  mk?: { mat?: number };
};

export function readActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("rf7_active_project");
  } catch {
    return null;
  }
}

export function loadWorkspace(projectId: string): WorkspaceShape | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = localStorage.getItem(`rf7_ws_${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceShape;
  } catch {
    return null;
  }
}

export function saveWorkspace(projectId: string, workspace: WorkspaceShape): void {
  if (typeof window === "undefined" || !projectId) return;
  try {
    localStorage.setItem(`rf7_ws_${projectId}`, JSON.stringify(workspace));
  } catch {
    /* quota / private mode */
  }
}

export function getDemolitionStateFromTrade(t: TradeShape | undefined): DemolitionV2State {
  const raw = t?.rfDemolition;
  const base: DemolitionV2State =
    !raw || typeof raw !== "object"
      ? { ...DEFAULT_STATE }
      : {
          ...DEFAULT_STATE,
          ...raw,
          materialQty:
            raw.materialQty && typeof raw.materialQty === "object" ? { ...raw.materialQty } : {},
        };
  if (!t?.catPick) return base;
  const mq = { ...base.materialQty };
  let changed = false;
  for (const [id, o] of Object.entries(t.catPick)) {
    const q = o?.q;
    if (typeof q === "number" && q > 0 && mq[id] === undefined) {
      mq[id] = q;
      changed = true;
    }
  }
  return changed ? { ...base, materialQty: mq } : base;
}

export function applyDemolitionToTrade(
  t: TradeShape,
  d: DemolitionV2State,
  products: CachedProductRow[],
): void {
  t.rfDemolition = { ...d };
  t.days = Math.max(0, d.labourDays);
  t.daysCustom = d.labourDaysTouched;
  const labourTotal = Math.max(0, d.labourDays) * Math.max(0, d.labourRate) * Math.max(1, d.workers);
  if (!t.labour) t.labour = { mode: "job", rate: 55, qty: 0, jobPrice: 0 };
  t.labour.mode = "job";
  t.labour.jobPrice = Math.round(labourTotal * 100) / 100;

  if (!t.catPick) t.catPick = {};
  for (const p of products) {
    const id = String(p.id);
    const qty = Math.max(0, d.materialQty[id] ?? 0);
    const sup =
      typeof p.price === "number"
        ? p.price
        : parseFloat(String(p.price ?? "").replace(/[^\d.]/g, "")) || 0;
    if (!t.catPick[id]) {
      t.catPick[id] = {
        q: qty,
        m: d.markupPct,
        sup,
        title: p.title ?? "—",
        brand: p.brand ?? "",
        priceLabel: p.price != null ? String(p.price) : "—",
        thumb: p.thumbnail ?? "",
      };
    } else {
      t.catPick[id].q = qty;
      t.catPick[id].m = d.markupPct;
      if (t.catPick[id].sup == null || t.catPick[id].sup === 0) t.catPick[id].sup = sup;
      if (!t.catPick[id].title) t.catPick[id].title = p.title ?? "—";
    }
  }
}

/** Sync auto labour days when calculator changes and user has not manually set labour days. */
export function maybeSyncAutoLabourDays(prev: DemolitionV2State, next: DemolitionV2State): DemolitionV2State {
  if (next.labourDaysTouched) return next;
  const auto = autoLabourDays(next.sqFt, next.stairs, next.hazmat);
  return { ...next, labourDays: auto };
}

export { DEFAULT_STATE as DEMOLITION_DEFAULT_STATE };
