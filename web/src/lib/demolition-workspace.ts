export type CachedProductRow = {
  id: string;
  thumbnail: string | null;
  brand: string | null;
  title: string | null;
  price: string | number | null;
  trade: string | null;
  subsection: string | null;
};

export type DemoScope = "full" | "selective";

export type DemoChecklistKey =
  | "drywall"
  | "tile_floor"
  | "tile_walls"
  | "hardwood"
  | "carpet"
  | "cabinetry"
  | "fixtures"
  | "openings"
  | "drop_ceiling"
  | "insulation"
  | "subfloor"
  | "concrete";

export const DEMOLITION_CHECKLIST: { key: DemoChecklistKey; label: string }[] = [
  { key: "drywall", label: "Drywall / plaster" },
  { key: "tile_floor", label: "Tile — floor" },
  { key: "tile_walls", label: "Tile — walls" },
  { key: "hardwood", label: "Hardwood / laminate" },
  { key: "carpet", label: "Carpet" },
  { key: "cabinetry", label: "Cabinetry / millwork" },
  { key: "fixtures", label: "Fixtures (toilet, tub, vanity, sink)" },
  { key: "openings", label: "Windows / doors" },
  { key: "drop_ceiling", label: "Drop ceiling / grid" },
  { key: "insulation", label: "Insulation" },
  { key: "subfloor", label: "Subfloor" },
  { key: "concrete", label: "Concrete / brick" },
];

export type DemoWorker = {
  id: string;
  name: string;
  days: number;
  rate: number;
};

export type DemolitionV3State = {
  v: 3;
  scope: DemoScope;
  checklist: Partial<Record<DemoChecklistKey, boolean>>;
  hazmat: boolean;
  dumpster: boolean;
  workers: DemoWorker[];
  clientLabourCharge: number;
  clientMaterialsMarkupPct: number;
  materialQty: Record<string, number>;
  /** When true, room-level applyAuto should not overwrite t.days */
  daysCustom: boolean;
};

export const RF_DEMOLITION_NOTE_PREFIX = "RF_DEMOLITION_V1\n";

const DEFAULT_WORKER = (): DemoWorker => ({
  id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: "",
  days: 1,
  rate: 450,
});

export const DEMOLITION_DEFAULT_STATE: DemolitionV3State = {
  v: 3,
  scope: "full",
  checklist: {},
  hazmat: false,
  dumpster: false,
  workers: [DEFAULT_WORKER()],
  clientLabourCharge: 0,
  clientMaterialsMarkupPct: 20,
  materialQty: {},
  daysCustom: true,
};

type TradeShape = {
  id?: string;
  days?: number;
  daysCustom?: boolean;
  labour?: { mode?: string; rate?: number; qty?: number; jobPrice?: number };
  note?: string;
  catPick?: Record<
    string,
    { q?: number; m?: number; sup?: number; title?: string; brand?: string; priceLabel?: string; thumb?: string }
  >;
  rfDemolition?: Partial<DemolitionV3State> & { v?: number };
  _demoMaterialLines?: Array<{
    code: string;
    label: string;
    unit: string;
    unit_price: number;
    quantity: number;
  }>;
};

type WorkspaceShape = {
  rooms?: Array<{
    n?: string;
    ic?: string;
    d?: Record<string, unknown>;
    trades?: TradeShape[];
    dbRoomId?: string;
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

export function packDemolitionNote(state: DemolitionV3State): string {
  return RF_DEMOLITION_NOTE_PREFIX + JSON.stringify(state);
}

export function unpackDemolitionNote(note: string | undefined | null): DemolitionV3State | null {
  if (!note || typeof note !== "string") return null;
  if (!note.startsWith(RF_DEMOLITION_NOTE_PREFIX)) return null;
  try {
    const raw = JSON.parse(note.slice(RF_DEMOLITION_NOTE_PREFIX.length)) as Partial<DemolitionV3State>;
    return normalizeDemolitionState(raw);
  } catch {
    return null;
  }
}

function normalizeDemolitionState(raw: Partial<DemolitionV3State>): DemolitionV3State {
  const base = { ...DEMOLITION_DEFAULT_STATE };
  if (raw.scope === "selective" || raw.scope === "full") base.scope = raw.scope;
  if (raw.checklist && typeof raw.checklist === "object") {
    base.checklist = { ...raw.checklist };
  }
  if (typeof raw.hazmat === "boolean") base.hazmat = raw.hazmat;
  if (typeof raw.dumpster === "boolean") base.dumpster = raw.dumpster;
  if (Array.isArray(raw.workers) && raw.workers.length > 0) {
    base.workers = raw.workers.map((w, i) => ({
      id: String(w.id || `w-${i}`),
      name: String(w.name || ""),
      days: Math.max(0, Number(w.days) || 0),
      rate: Math.max(0, Number(w.rate) || 0),
    }));
  }
  if (typeof raw.clientLabourCharge === "number") base.clientLabourCharge = Math.max(0, raw.clientLabourCharge);
  if (typeof raw.clientMaterialsMarkupPct === "number")
    base.clientMaterialsMarkupPct = Math.max(0, raw.clientMaterialsMarkupPct);
  if (raw.materialQty && typeof raw.materialQty === "object") base.materialQty = { ...raw.materialQty };
  if (typeof raw.daysCustom === "boolean") base.daysCustom = raw.daysCustom;
  return base;
}

/** Migrate legacy V2 rfDemolition blob (best-effort). */
function fromLegacyV2(raw: Record<string, unknown>): DemolitionV3State {
  const s = { ...DEMOLITION_DEFAULT_STATE };
  if (typeof raw.hazmat === "boolean") s.hazmat = raw.hazmat;
  if (raw.materialQty && typeof raw.materialQty === "object") {
    s.materialQty = { ...(raw.materialQty as Record<string, number>) };
  }
  const ld = Number(raw.labourDays);
  const lr = Number(raw.labourRate);
  const wn = Math.max(1, Number(raw.workers) || 1);
  if (ld > 0 || lr > 0) {
    s.workers = Array.from({ length: wn }, (_, i) => ({
      id: `w-mig-${i}`,
      name: wn > 1 ? `Worker ${i + 1}` : "",
      days: Math.max(0, ld || 1),
      rate: Math.max(0, lr || 450),
    }));
  }
  if (typeof raw.markupPct === "number") s.clientMaterialsMarkupPct = raw.markupPct;
  const dt = raw.demoType;
  if (dt === "selective") s.scope = "selective";
  if (typeof raw.exteriorDumpster === "boolean") s.dumpster = raw.exteriorDumpster;
  return s;
}

export function getDemolitionStateFromTrade(t: TradeShape | undefined): DemolitionV3State {
  if (!t) return { ...DEMOLITION_DEFAULT_STATE };

  const fromNote = unpackDemolitionNote(t.note);
  if (fromNote) {
    return mergeCatPickIntoQty(fromNote, t);
  }

  const raw = t.rfDemolition;
  if (raw && typeof raw === "object") {
    if (raw.v === 3) {
      return mergeCatPickIntoQty(normalizeDemolitionState(raw), t);
    }
    return mergeCatPickIntoQty(fromLegacyV2(raw as Record<string, unknown>), t);
  }

  const base = { ...DEMOLITION_DEFAULT_STATE };
  return mergeCatPickIntoQty(base, t);
}

function mergeCatPickIntoQty(state: DemolitionV3State, t: TradeShape): DemolitionV3State {
  if (!t.catPick) return state;
  const mq = { ...state.materialQty };
  let changed = false;
  for (const [id, o] of Object.entries(t.catPick)) {
    const q = o?.q;
    if (typeof q === "number" && q > 0 && mq[id] === undefined) {
      mq[id] = q;
      changed = true;
    }
  }
  return changed ? { ...state, materialQty: mq } : state;
}

export function myLabourCost(workers: DemoWorker[]): number {
  let s = 0;
  for (const w of workers) {
    s += Math.max(0, w.days) * Math.max(0, w.rate);
  }
  return Math.round(s * 100) / 100;
}

export function maxWorkerDays(workers: DemoWorker[]): number {
  let m = 0;
  for (const w of workers) m = Math.max(m, Math.max(0, w.days));
  return m;
}

export function applyDemolitionToTrade(
  t: TradeShape,
  d: DemolitionV3State,
  products: CachedProductRow[],
): void {
  t.rfDemolition = { ...d, v: 3 };
  const maxD = maxWorkerDays(d.workers);
  t.days = Math.max(0, maxD);
  t.daysCustom = !!d.daysCustom;
  t.note = packDemolitionNote({ ...d, v: 3 });

  const myLab = myLabourCost(d.workers);
  if (!t.labour) t.labour = { mode: "job", rate: 55, qty: 0, jobPrice: 0 };
  t.labour.mode = "job";
  const clientLab = d.clientLabourCharge > 0 ? d.clientLabourCharge : Math.round(myLab * 100) / 100;
  t.labour.jobPrice = Math.round(clientLab * 100) / 100;

  if (!t.catPick) t.catPick = {};
  const lines: NonNullable<TradeShape["_demoMaterialLines"]> = [];
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
        m: d.clientMaterialsMarkupPct,
        sup,
        title: p.title ?? "—",
        brand: p.brand ?? "",
        priceLabel: p.price != null ? String(p.price) : "—",
        thumb: p.thumbnail ?? "",
      };
    } else {
      t.catPick[id].q = qty;
      t.catPick[id].m = d.clientMaterialsMarkupPct;
      if (t.catPick[id].sup == null || t.catPick[id].sup === 0) t.catPick[id].sup = sup;
      if (!t.catPick[id].title) t.catPick[id].title = p.title ?? "—";
    }
    if (qty > 0) {
      lines.push({
        code: id,
        label: String(p.title ?? "Material"),
        unit: "ea",
        unit_price: sup,
        quantity: qty,
      });
    }
  }
  t._demoMaterialLines = lines;
}
