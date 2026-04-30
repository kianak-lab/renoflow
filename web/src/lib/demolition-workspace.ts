import { totalLabourHours } from "./demolition-calculations";

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

export type LabourCostMode = "job" | "daily" | "hourly";

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

/** Private crew cost: hourly ↔ day (8 hr day) kept in sync in UI. */
export type DemoWorker = {
  id: string;
  name: string;
  days: number;
  hourlyMyCost: number;
  myCostPerDay: number;
};

export type DemolitionV3State = {
  v: 3;
  /** How labour billed to the client is calculated (Labour tab, top card). */
  labourCostMode: LabourCostMode;
  /** Client: flat labour charge when mode is per job. */
  myLabourPerJob: number;
  /** Client: billed days × rate when mode is daily. */
  myCostDailyDays: number;
  myCostDailyRate: number;
  /** Client: billed hours × rate when mode is hourly. */
  myCostHourlyHours: number;
  myCostHourlyRate: number;
  workerExpenseEnabled: boolean;
  workers: DemoWorker[];
  wasteDisposalEnabled: boolean;
  wasteDisposalAmount: number;
  /** Denormalized: always equals clientLabourBilled(); kept for JSON / APIs. */
  clientLabourCharge: number;
  clientMaterialsMarkupPct: number;
  /** When false, material cost is your expense only (not on client quote). Default true. */
  materialsBillToClient: boolean;
  materialQty: Record<string, number>;
  scope: DemoScope;
  checklist: Partial<Record<DemoChecklistKey, boolean>>;
  hazmat: boolean;
  dumpster: boolean;
  daysCustom: boolean;
  scheduleTradeEnabled: boolean;
  /** When true, per-day timeline descriptions are merged into the estimate timeline (explicit user action). */
  timelineDescriptionsOnQuote: boolean;
  timelineTotalDays: number;
  timelineDayDescriptions: string[];
};

export const RF_DEMOLITION_NOTE_PREFIX = "RF_DEMOLITION_V1\n";

const HRS_PER_DAY = 8;

function round2(n: number): number {
  return Math.round(Math.max(0, n) * 100) / 100;
}

/** Labour amount billed to the client (from Labour tab — top card only). */
export function clientLabourBilled(d: DemolitionV3State): number {
  if (d.labourCostMode === "job") return round2(d.myLabourPerJob);
  if (d.labourCostMode === "daily") {
    return round2(Math.max(0, d.myCostDailyDays) * Math.max(0, d.myCostDailyRate));
  }
  return round2(Math.max(0, d.myCostHourlyHours) * Math.max(0, d.myCostHourlyRate));
}

export function hourlyFromDayCost(dayCost: number): number {
  return round2(dayCost / HRS_PER_DAY);
}

export function dayCostFromHourly(hourly: number): number {
  return round2(hourly * HRS_PER_DAY);
}

const DEFAULT_WORKER = (): DemoWorker => ({
  id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: "",
  days: 1,
  hourlyMyCost: 25,
  myCostPerDay: 200,
});

export const DEMOLITION_DEFAULT_STATE: DemolitionV3State = {
  v: 3,
  labourCostMode: "daily",
  myLabourPerJob: 0,
  myCostDailyDays: 0,
  myCostDailyRate: 200,
  myCostHourlyHours: 0,
  myCostHourlyRate: 25,
  workerExpenseEnabled: false,
  workers: [DEFAULT_WORKER()],
  wasteDisposalEnabled: false,
  wasteDisposalAmount: 0,
  clientLabourCharge: 0,
  clientMaterialsMarkupPct: 20,
  materialsBillToClient: true,
  materialQty: {},
  scope: "full",
  checklist: {},
  hazmat: false,
  dumpster: false,
  daysCustom: true,
  scheduleTradeEnabled: false,
  timelineDescriptionsOnQuote: false,
  timelineTotalDays: 1,
  timelineDayDescriptions: [""],
};

type TradeShape = {
  id?: string;
  days?: number;
  daysCustom?: boolean;
  labour?: { mode?: string; rate?: number; qty?: number; jobPrice?: number };
  /** Mirrors DemolitionV3State.materialsBillToClient for final.html quote math. */
  materialsBillToClient?: boolean;
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

export type WorkspaceShape = {
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

function normalizeWorkerRow(
  w: unknown,
  i: number,
): { worker: DemoWorker; legacyClientLine: number } {
  const o = w as unknown as Record<string, unknown>;
  const legacyRate = typeof o.rate === "number" && !Number.isNaN(o.rate) ? o.rate : null;
  const myRaw = o.myCostPerDay;
  const crRaw = o.clientRatePerDay;
  const days = Math.max(0, Number(o.days) || 0);

  let myCostPerDay = Math.max(0, Number(myRaw) || 0);
  let hourlyMyCost =
    typeof o.hourlyMyCost === "number" && !Number.isNaN(o.hourlyMyCost)
      ? Math.max(0, o.hourlyMyCost)
      : 0;

  let legacyClientLine = 0;
  if (typeof crRaw === "number" && !Number.isNaN(crRaw)) {
    legacyClientLine = days * Math.max(0, crRaw);
  }

  if (
    legacyRate !== null &&
    myRaw === undefined &&
    crRaw === undefined &&
    o.hourlyMyCost === undefined
  ) {
    myCostPerDay = 200;
    hourlyMyCost = hourlyFromDayCost(myCostPerDay);
    legacyClientLine = days * Math.max(0, legacyRate);
  } else {
    if (myCostPerDay === 0 && hourlyMyCost > 0) myCostPerDay = dayCostFromHourly(hourlyMyCost);
    if (hourlyMyCost === 0 && myCostPerDay > 0) hourlyMyCost = hourlyFromDayCost(myCostPerDay);
    if (myCostPerDay === 0 && hourlyMyCost === 0) {
      myCostPerDay = 200;
      hourlyMyCost = hourlyFromDayCost(myCostPerDay);
    }
  }

  return {
    worker: {
      id: String(o.id || `w-${i}`),
      name: String(o.name || ""),
      days,
      hourlyMyCost,
      myCostPerDay,
    },
    legacyClientLine,
  };
}

function syncTimelineDescriptions(
  days: number,
  desc: string[] | undefined,
): string[] {
  const n = Math.max(1, Math.min(60, Math.floor(days) || 1));
  const base = Array.isArray(desc) ? [...desc] : [];
  while (base.length < n) base.push("");
  while (base.length > n) base.pop();
  return base;
}

function normalizeDemolitionState(raw: Partial<DemolitionV3State>): DemolitionV3State {
  const base = { ...DEMOLITION_DEFAULT_STATE };
  if (raw.scope === "selective" || raw.scope === "full") base.scope = raw.scope;
  if (raw.checklist && typeof raw.checklist === "object") {
    base.checklist = { ...raw.checklist };
  }
  if (typeof raw.hazmat === "boolean") base.hazmat = raw.hazmat;
  if (typeof raw.dumpster === "boolean") base.dumpster = raw.dumpster;

  if (raw.labourCostMode === "job" || raw.labourCostMode === "daily" || raw.labourCostMode === "hourly") {
    base.labourCostMode = raw.labourCostMode;
  }
  if (typeof raw.myLabourPerJob === "number") base.myLabourPerJob = Math.max(0, raw.myLabourPerJob);
  if (typeof raw.myCostDailyDays === "number") base.myCostDailyDays = Math.max(0, raw.myCostDailyDays);
  if (typeof raw.myCostDailyRate === "number") base.myCostDailyRate = Math.max(0, raw.myCostDailyRate);
  if (typeof raw.myCostHourlyHours === "number")
    base.myCostHourlyHours = Math.max(0, raw.myCostHourlyHours);
  if (typeof raw.myCostHourlyRate === "number") base.myCostHourlyRate = Math.max(0, raw.myCostHourlyRate);
  if (
    raw.myCostDailyDays === undefined &&
    raw.myCostDailyRate === undefined &&
    raw.myCostHourlyHours === undefined &&
    raw.myCostHourlyRate === undefined
  ) {
    base.myCostDailyDays = 0;
    base.myCostHourlyHours = 0;
  }
  if (typeof raw.workerExpenseEnabled === "boolean") {
    base.workerExpenseEnabled = raw.workerExpenseEnabled;
  } else {
    /* Missing field: use catalogue default (Worker expense starts collapsed). */
    base.workerExpenseEnabled = DEMOLITION_DEFAULT_STATE.workerExpenseEnabled;
  }
  if (typeof raw.wasteDisposalEnabled === "boolean") base.wasteDisposalEnabled = raw.wasteDisposalEnabled;
  if (typeof raw.wasteDisposalAmount === "number")
    base.wasteDisposalAmount = Math.max(0, raw.wasteDisposalAmount);
  if (typeof raw.scheduleTradeEnabled === "boolean") base.scheduleTradeEnabled = raw.scheduleTradeEnabled;
  if (typeof raw.timelineDescriptionsOnQuote === "boolean")
    base.timelineDescriptionsOnQuote = raw.timelineDescriptionsOnQuote;
  if (typeof raw.timelineTotalDays === "number") base.timelineTotalDays = Math.max(1, raw.timelineTotalDays);

  let migratedClientSum = 0;
  if (Array.isArray(raw.workers) && raw.workers.length > 0) {
    base.workers = raw.workers.map((w, i) => {
      const { worker, legacyClientLine } = normalizeWorkerRow(w, i);
      migratedClientSum += legacyClientLine;
      return worker;
    });
  }
  if (clientLabourBilled(base) === 0 && migratedClientSum > 0) {
    base.labourCostMode = "job";
    base.myLabourPerJob = round2(migratedClientSum);
  }

  if (typeof raw.clientMaterialsMarkupPct === "number")
    base.clientMaterialsMarkupPct = Math.max(0, raw.clientMaterialsMarkupPct);
  if (typeof raw.materialsBillToClient === "boolean") base.materialsBillToClient = raw.materialsBillToClient;
  if (raw.materialQty && typeof raw.materialQty === "object") base.materialQty = { ...raw.materialQty };
  if (typeof raw.daysCustom === "boolean") base.daysCustom = raw.daysCustom;

  base.timelineDayDescriptions = syncTimelineDescriptions(
    base.timelineTotalDays,
    raw.timelineDayDescriptions,
  );
  base.timelineTotalDays = base.timelineDayDescriptions.length;

  if (
    clientLabourBilled(base) === 0 &&
    typeof raw.clientLabourCharge === "number" &&
    raw.clientLabourCharge > 0
  ) {
    base.labourCostMode = "job";
    base.myLabourPerJob = Math.max(0, raw.clientLabourCharge);
  }
  base.clientLabourCharge = clientLabourBilled(base);

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
    const clientDay = Math.max(0, lr || 450);
    const myDay = 200;
    s.workers = Array.from({ length: wn }, (_, i) => ({
      id: `w-mig-${i}`,
      name: wn > 1 ? `Worker ${i + 1}` : "",
      days: Math.max(0, ld || 1),
      hourlyMyCost: hourlyFromDayCost(myDay),
      myCostPerDay: myDay,
    }));
    s.workerExpenseEnabled = true;
    s.labourCostMode = "job";
    s.myLabourPerJob = round2(wn * Math.max(0, ld || 1) * clientDay);
    s.clientLabourCharge = s.myLabourPerJob;
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

/** Private labour from the worker expense grid only (your cost). */
export function workerLabourCost(d: DemolitionV3State): number {
  if (!d.workerExpenseEnabled) return 0;
  let s = 0;
  for (const w of d.workers) {
    s += Math.max(0, w.days) * Math.max(0, w.myCostPerDay);
  }
  return round2(s);
}

/** Your total private labour cost (worker grid only — not client bill). */
export function myLabourCost(d: DemolitionV3State): number {
  return workerLabourCost(d);
}

export function myWasteCost(d: DemolitionV3State): number {
  if (!d.wasteDisposalEnabled) return 0;
  return round2(d.wasteDisposalAmount);
}

export function crewBillableHours(d: DemolitionV3State): number {
  if (!d.workerExpenseEnabled) return 0;
  return totalLabourHours(d.workers);
}

export function maxWorkerDays(workers: DemoWorker[]): number {
  let m = 0;
  for (const w of workers) m = Math.max(m, Math.max(0, w.days));
  return m;
}

/**
 * Snapshot for `trade.rfDemolition` when syncing workspace / merges. Full editable state
 * stays in `trade.note` (RF_DEMOLITION_V1); this blob omits private crew rates and
 * demolition timeline copy when "Schedule this trade" is off so quote-facing data paths
 * never carry MY COSTS fields or internal day notes.
 */
export function sanitizeDemolitionForQuoteRfBlob(d: DemolitionV3State): DemolitionV3State {
  const workers = d.workers.map((w) => ({
    ...w,
    hourlyMyCost: 0,
    myCostPerDay: 0,
  }));
  let timelineTotalDays = d.timelineTotalDays;
  let timelineDayDescriptions = d.timelineDayDescriptions;
  let scheduleTradeEnabled = d.scheduleTradeEnabled;
  let timelineDescriptionsOnQuote = !!d.timelineDescriptionsOnQuote;
  if (!d.scheduleTradeEnabled) {
    scheduleTradeEnabled = false;
    timelineDescriptionsOnQuote = false;
    timelineTotalDays = 1;
    timelineDayDescriptions = [""];
  }
  const out: DemolitionV3State = {
    ...d,
    v: 3,
    workers,
    workerExpenseEnabled: false,
    scheduleTradeEnabled,
    timelineDescriptionsOnQuote,
    timelineTotalDays,
    timelineDayDescriptions,
    clientLabourCharge: clientLabourBilled(d),
  };
  return out;
}

export function applyDemolitionToTrade(
  t: TradeShape,
  d: DemolitionV3State,
  products: CachedProductRow[],
): void {
  const packed: DemolitionV3State = { ...d, v: 3 };
  t.rfDemolition = sanitizeDemolitionForQuoteRfBlob(packed);
  const wmax = d.workerExpenseEnabled ? maxWorkerDays(d.workers) : 0;
  const tmax = d.scheduleTradeEnabled ? Math.max(0, d.timelineTotalDays) : 0;
  t.days = Math.max(wmax, tmax);
  t.daysCustom = !!d.daysCustom;
  t.note = packDemolitionNote(packed);
  t.materialsBillToClient = d.materialsBillToClient;

  if (!t.labour) t.labour = { mode: "job", rate: 55, qty: 0, jobPrice: 0 };
  t.labour.mode = "job";
  t.labour.jobPrice = clientLabourBilled(d);

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
  /** Align every catalog line with demolition quantities so client billing includes all picked rows. */
  for (const id of Object.keys(t.catPick)) {
    const row = t.catPick[id];
    if (!row) continue;
    const qty = Math.max(0, d.materialQty[id] ?? 0);
    row.q = qty;
    if (d.materialsBillToClient && qty > 0) {
      row.m = d.clientMaterialsMarkupPct;
    }
  }
  t._demoMaterialLines = lines;
}
