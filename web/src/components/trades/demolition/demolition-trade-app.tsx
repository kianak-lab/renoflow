"use client";

import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ceilingFtFromDims,
  floorSqFtFromDims,
  formatDimsLine,
  formatMoney,
  parsePrice,
} from "@/lib/demolition-calculations";
import {
  applyDemolitionToTrade,
  crewBillableHours,
  dayCostFromHourly,
  DEMOLITION_CHECKLIST,
  type CachedProductRow,
  type DemoChecklistKey,
  type DemoScope,
  type DemoWorker,
  type DemolitionV3State,
  DEMOLITION_DEFAULT_STATE,
  type LabourCostMode,
  getDemolitionStateFromTrade,
  hourlyFromDayCost,
  loadWorkspace,
  myLabourCost,
  myWasteCost,
  readActiveProjectId,
  saveWorkspace,
} from "@/lib/demolition-workspace";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Site Yellow — RenoFlow trade card */
const SITE = {
  yellow: "#FFE000",
  ink: "#111111",
  muted: "#888888",
  subtleBg: "#f0f0f0",
  white: "#ffffff",
  cardBg: "#f9f9f9",
  border: "#e0e0e0",
  myCostsBorder: "#222222",
  myCostsTotalBg: "#efefef",
  green: "#2d7a2d",
  greenTint: "rgba(45,122,45,0.06)",
  profitLabel: "#7a6200",
  profitBg: "#fffbe6",
} as const;

const sectionLabelCls =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888]";

type TabKey = "labour" | "materials" | "totals" | "timeline";

function useDebouncedFn<T>(fn: (arg: T) => void, ms: number): (arg: T) => void {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = useRef(fn);
  f.current = fn;
  return useCallback(
    (arg: T) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => f.current(arg), ms);
    },
    [ms],
  );
}

export default function DemolitionTradeApp() {
  const router = useRouter();
  const sp = useSearchParams();
  const ri = Number(sp.get("ri") ?? "0");
  const ti = Number(sp.get("ti") ?? "0");
  const pidParam = sp.get("pid");
  const dbRoomIdParam = sp.get("dbRoomId") ?? "";

  const [tab, setTab] = useState<TabKey>("labour");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [products, setProducts] = useState<CachedProductRow[]>([]);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [d, setD] = useState<DemolitionV3State>(DEMOLITION_DEFAULT_STATE);
  const dRef = useRef(d);
  dRef.current = d;

  const projectId = pidParam || readActiveProjectId() || "";
  const room = useMemo(() => {
    if (!projectId) return null;
    const ws = loadWorkspace(projectId);
    return ws?.rooms?.[ri] ?? null;
  }, [projectId, ri]);

  const roomName = room?.n ?? "Room";
  const dims = room?.d as Record<string, unknown> | undefined;
  const sqFt = useMemo(() => floorSqFtFromDims(dims), [dims]);
  const ceilingFt = useMemo(() => ceilingFtFromDims(dims), [dims]);
  const dimsLine = useMemo(() => formatDimsLine(dims), [dims]);

  const loadFromStorage = useCallback(() => {
    if (!projectId) return;
    const ws = loadWorkspace(projectId);
    if (!ws?.rooms?.[ri]?.trades?.[ti]) return;
    const t = ws.rooms[ri]!.trades![ti]!;
    if (t.id !== "demo") return;
    setD(getDemolitionStateFromTrade(t));
  }, [projectId, ri, ti]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "/api/cached-products?trade=" + encodeURIComponent("Demolition"),
          { credentials: "include" },
        );
        const j = (await res.json()) as { products?: CachedProductRow[]; error?: string };
        if (!res.ok) throw new Error(j.error || "Could not load materials");
        if (!cancelled) {
          setProducts(j.products ?? []);
          setProductsErr(null);
        }
      } catch (e) {
        if (!cancelled) setProductsErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLocal = useCallback(
    (next: DemolitionV3State) => {
      if (!projectId) return;
      const ws = loadWorkspace(projectId);
      if (!ws || !ws.rooms?.[ri]?.trades?.[ti]) return;
      const trades = ws.rooms[ri]!.trades!;
      const t = trades[ti]!;
      if (t.id !== "demo") return;
      applyDemolitionToTrade(t, next, products);
      saveWorkspace(projectId, ws);
    },
    [projectId, ri, ti, products],
  );

  const persistRemote = useCallback(
    async (next: DemolitionV3State) => {
      const dbRoomId = dbRoomIdParam || (room?.dbRoomId as string | undefined);
      if (!dbRoomId) return;
      const ws = loadWorkspace(projectId);
      if (!ws || !ws.rooms?.[ri]?.trades) return;
      const roomRow = ws.rooms[ri]!;
      const tradesPayload = (roomRow.trades || []).map((raw, j) => {
        const t = raw as Record<string, unknown> & {
          id?: string;
          note?: string;
          open?: boolean;
          days?: number;
          daysCustom?: boolean;
          items?: Array<{ id?: string; qty?: number; p?: number; wasAuto?: boolean }>;
        };
        if (t.id === "demo" && j === ti) {
          const clone = { ...t } as Parameters<typeof applyDemolitionToTrade>[0];
          applyDemolitionToTrade(clone, next, products);
          const demoMat = (clone as { _demoMaterialLines?: unknown })._demoMaterialLines;
          return {
            id: "demo",
            note: String((clone as { note?: string }).note ?? ""),
            open: !!(clone as { open?: boolean }).open,
            days: (clone as { days?: number }).days ?? 0,
            daysCustom: !!(clone as { daysCustom?: boolean }).daysCustom,
            items: [],
            demoMaterialLines: Array.isArray(demoMat) ? demoMat : [],
          };
        }
        return {
          id: String(t.id ?? ""),
          note: String(t.note ?? ""),
          open: !!t.open,
          days: t.days ?? 0,
          daysCustom: !!t.daysCustom,
          items: (t.items || []).map((it) => ({
            id: it.id,
            qty: it.qty ?? 0,
            p: it.p,
            wasAuto: !!it.wasAuto,
          })),
        };
      });
      await fetch("/api/rooms/" + encodeURIComponent(dbRoomId), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomRow.n,
          icon: roomRow.ic ?? null,
          sort_order: ri,
          dimensions: roomRow.d || {},
          trades: tradesPayload,
        }),
      }).catch(() => {});
    },
    [dbRoomIdParam, room, projectId, ri, ti, products],
  );

  const debouncedLocal = useDebouncedFn(persistLocal, 280);
  const debouncedRemote = useDebouncedFn(
    useCallback((next: DemolitionV3State) => void persistRemote(next), [persistRemote]),
    600,
  );

  const update = useCallback(
    (patch: Partial<DemolitionV3State> | ((prev: DemolitionV3State) => DemolitionV3State)) => {
      setD((prev) => {
        const base = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        const next = { ...base, v: 3 as const };
        debouncedLocal(next);
        debouncedRemote(next);
        return next;
      });
    },
    [debouncedLocal, debouncedRemote],
  );

  const materialMyCost = useMemo(() => {
    let s = 0;
    for (const p of products) {
      const q = d.materialQty[String(p.id)] ?? 0;
      if (q <= 0) continue;
      s += parsePrice(p.price) * q;
    }
    return Math.round(s * 100) / 100;
  }, [products, d.materialQty]);

  const labourMyCost = useMemo(() => myLabourCost(d), [d]);
  const wasteMy = useMemo(() => myWasteCost(d), [d]);

  const myCostsTotal = labourMyCost + materialMyCost + wasteMy;

  const clientMaterialsCharge = useMemo(() => {
    const mk = 1 + Math.max(0, d.clientMaterialsMarkupPct) / 100;
    return Math.round(materialMyCost * mk * 100) / 100;
  }, [materialMyCost, d.clientMaterialsMarkupPct]);

  const clientWastePass = d.wasteDisposalEnabled ? Math.round(d.wasteDisposalAmount * 100) / 100 : 0;

  const clientTotal = useMemo(() => {
    return Math.round(
      (d.clientLabourCharge + clientMaterialsCharge + clientWastePass) * 100,
    ) / 100;
  }, [d.clientLabourCharge, clientMaterialsCharge, clientWastePass]);

  const profit = Math.round((clientTotal - myCostsTotal) * 100) / 100;
  const profitPerSq = sqFt > 0 ? Math.round((profit / sqFt) * 100) / 100 : 0;
  const hrs = useMemo(() => crewBillableHours(d), [d]);
  const profitPerHr = hrs > 0 ? Math.round((profit / hrs) * 100) / 100 : 0;
  const marginPct = clientTotal > 0 ? Math.round((profit / clientTotal) * 1000) / 10 : 0;
  const clientRatePerSq = sqFt > 0 ? Math.round((clientTotal / sqFt) * 100) / 100 : 0;

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, CachedProductRow[]>();
    for (const p of products) {
      const k =
        p.subsection && String(p.subsection).trim()
          ? String(p.subsection).trim()
          : "(Uncategorized)";
      if (!map.has(k)) {
        map.set(k, []);
        order.push(k);
      }
      map.get(k)!.push(p);
    }
    return { order, map };
  }, [products]);

  function back() {
    if (projectId) persistLocal(dRef.current);
    router.push("/final");
  }

  function pushCalendar() {
    if (projectId) persistLocal(dRef.current);
    try {
      sessionStorage.setItem(
        "rf_after_demolition_nav",
        JSON.stringify({ pg: "tl", ri, ts: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    void persistRemote(dRef.current);
    router.push("/final");
  }

  function toggleChecklist(key: DemoChecklistKey) {
    update((prev) => {
      const checklist = { ...prev.checklist, [key]: !prev.checklist[key] };
      return { ...prev, checklist };
    });
  }

  function newWorker(): DemoWorker {
    return {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: "",
      days: 1,
      hourlyMyCost: 25,
      myCostPerDay: 200,
    };
  }

  function addWorker() {
    update((prev) => ({
      ...prev,
      workers: [...prev.workers, newWorker()],
    }));
  }

  function removeWorker(id: string) {
    update((prev) => {
      if (!prev.workerExpenseEnabled) return prev;
      const next = prev.workers.filter((w) => w.id !== id);
      return {
        ...prev,
        workers: next.length ? next : [newWorker()],
      };
    });
  }

  function patchWorker(id: string, patch: Partial<DemoWorker>) {
    update((prev) => ({
      ...prev,
      workers: prev.workers.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function setWorkerHourly(id: string, hourly: number) {
    const h = Math.max(0, hourly);
    patchWorker(id, { hourlyMyCost: h, myCostPerDay: dayCostFromHourly(h) });
  }

  function setWorkerDayCost(id: string, dayCost: number) {
    const dc = Math.max(0, dayCost);
    patchWorker(id, { myCostPerDay: dc, hourlyMyCost: hourlyFromDayCost(dc) });
  }

  function setTimelineDays(n: number) {
    const nextDays = Math.max(1, Math.min(60, Math.floor(n) || 1));
    update((prev) => {
      const desc = [...prev.timelineDayDescriptions];
      while (desc.length < nextDays) desc.push("");
      while (desc.length > nextDays) desc.pop();
      return { ...prev, timelineTotalDays: nextDays, timelineDayDescriptions: desc };
    });
  }

  function setDayNote(dayIndex: number, text: string) {
    update((prev) => {
      const desc = [...prev.timelineDayDescriptions];
      if (desc[dayIndex] === undefined) return prev;
      desc[dayIndex] = text;
      return { ...prev, timelineDayDescriptions: desc };
    });
  }

  const workerSlotLabel = (w: DemoWorker, idx: number) =>
    w.name.trim() || `Worker ${idx + 1}`;

  const cardStyle = {
    background: SITE.cardBg,
    border: `0.5px solid ${SITE.border}`,
    borderRadius: 8,
  } as const;

  const monoNum = `${plexMono.className} text-[14px] font-medium tabular-nums`;

  return (
    <div
      className={`${plexSans.className} fixed inset-0 z-[300] flex max-w-[100vw] flex-col overflow-x-hidden bg-white text-[13px] text-neutral-900 antialiased`}
      style={{
        minHeight: "100dvh",
        fontSize: 13,
      }}
    >
      <header className="shrink-0" style={{ background: SITE.yellow }}>
        <div className="flex items-start gap-2 px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={back}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-2xl font-semibold"
            style={{ color: SITE.ink }}
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight" style={{ color: SITE.ink }}>
              Demolition
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[#888]">
              Structure · {roomName}
              {sqFt > 0 ? ` · ${sqFt} sq ft` : ceilingFt > 0 ? ` · ${ceilingFt} ft ceiling` : ""}
            </p>
          </div>
        </div>
      </header>

      <div
        className="shrink-0 border-b bg-white px-2 py-2"
        style={{ borderColor: SITE.border }}
      >
        <div className="flex w-full gap-2">
          {(
            [
              ["labour", "Labour"],
              ["materials", "Materials"],
              ["totals", "Totals"],
              ["timeline", "Timeline"],
            ] as const
          ).map(([k, label]) => {
            const on = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="min-h-[44px] flex-1 px-1 text-center text-[13px] font-semibold transition-colors"
                style={{
                  borderRadius: 100,
                  background: on ? SITE.yellow : SITE.subtleBg,
                  color: on ? SITE.ink : SITE.muted,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        style={{ background: SITE.white }}
      >
        {!projectId ? (
          <p className="text-[13px] text-[#888]">
            Open Demolition from a project room in RenoFlow so your work saves to the active job.
          </p>
        ) : null}

        {tab === "labour" && (
          <div className="flex min-w-0 flex-col gap-4">
            <div style={cardStyle} className="px-3 py-3">
              <div className={sectionLabelCls}>My cost</div>
              <div className="mt-2 flex w-full gap-2">
                {(["job", "daily", "hourly"] as LabourCostMode[]).map((m) => {
                  const on = d.labourCostMode === m;
                  const label = m === "job" ? "Per job" : m === "daily" ? "Daily" : "Hourly";
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ labourCostMode: m })}
                      className="min-h-[44px] flex-1 text-[13px] font-semibold"
                      style={{
                        borderRadius: 100,
                        background: on ? SITE.yellow : SITE.subtleBg,
                        color: on ? SITE.ink : SITE.muted,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {d.labourCostMode === "job" ? (
                <label className="mt-3 block">
                  <span className="text-[13px] text-neutral-800">My labour cost (job)</span>
                  <div className="mt-1 flex min-h-[44px] items-center gap-2 rounded-lg border bg-white px-3" style={{ borderColor: SITE.border }}>
                    <span className="text-[#888]">$</span>
                    <input
                      type="number"
                      min={0}
                      className={`min-h-[44px] w-full flex-1 bg-transparent text-[13px] outline-none ${plexMono.className}`}
                      value={d.myLabourPerJob || ""}
                      onChange={(e) =>
                        update({ myLabourPerJob: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                </label>
              ) : (
                <p className="mt-2 text-[13px] leading-snug text-[#888]">
                  Turn on <strong>Worker expense</strong> below to enter crew days, hourly rate, and
                  day cost (linked at 8 hrs/day).
                </p>
              )}
            </div>

            <div style={cardStyle} className="overflow-hidden">
              <div className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 py-2 text-left"
                  onClick={() =>
                    update({ workerExpenseEnabled: !d.workerExpenseEnabled })
                  }
                >
                  <div className="text-[13px] font-semibold text-neutral-900">Worker expense</div>
                  <div className="text-[12px] text-[#888]">Crew days, rates — private</div>
                </button>
                <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <SiteSwitch
                    on={d.workerExpenseEnabled}
                    onChange={(workerExpenseEnabled) => update({ workerExpenseEnabled })}
                  />
                </span>
              </div>
              {d.workerExpenseEnabled && d.labourCostMode !== "job" ? (
                <div className="space-y-3 border-t px-3 pb-3 pt-2" style={{ borderColor: SITE.border }}>
                  {d.workers.map((w, idx) => {
                    const colOrder =
                      d.labourCostMode === "hourly"
                        ? (["days", "hourly", "day"] as const)
                        : (["days", "day", "hourly"] as const);
                    const daysCol = (
                      <div key="days" className="min-w-0">
                        <div className={sectionLabelCls}>Days</div>
                        <DaysStepper
                          value={w.days}
                          onChange={(days) => patchWorker(w.id, { days })}
                        />
                      </div>
                    );
                    const hourlyCol = (
                      <div key="hourly" className="min-w-0">
                        <div className={sectionLabelCls}>Hourly</div>
                        <div
                          className="mt-1 flex min-h-[44px] items-center gap-1 rounded-lg border bg-white px-2"
                          style={{ borderColor: SITE.border }}
                        >
                          <span className="text-[#888]">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className={`min-h-[44px] w-full bg-transparent text-[13px] outline-none ${plexMono.className}`}
                            value={w.hourlyMyCost || ""}
                            onChange={(e) =>
                              setWorkerHourly(w.id, Number(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                    );
                    const dayCol = (
                      <div key="day" className="min-w-0">
                        <div className={sectionLabelCls}>Day cost</div>
                        <div
                          className="mt-1 flex min-h-[44px] items-center gap-1 rounded-lg border bg-white px-2"
                          style={{ borderColor: SITE.border }}
                        >
                          <span className="text-[#888]">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className={`min-h-[44px] w-full bg-transparent text-[13px] outline-none ${plexMono.className}`}
                            value={w.myCostPerDay || ""}
                            onChange={(e) =>
                              setWorkerDayCost(w.id, Number(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                    );
                    const byKey = { days: daysCol, hourly: hourlyCol, day: dayCol };
                    return (
                      <div key={w.id} style={cardStyle} className="bg-white px-2 py-3">
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#e0e0e0] px-2 text-[13px] outline-none"
                            placeholder={workerSlotLabel(w, idx)}
                            value={w.name}
                            onChange={(e) => patchWorker(w.id, { name: e.target.value })}
                          />
                          <button
                            type="button"
                            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border text-lg"
                            style={{ borderColor: SITE.border }}
                            onClick={() => removeWorker(w.id)}
                            aria-label="Remove worker"
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid w-full min-w-0 grid-cols-3 gap-2">
                          {colOrder.map((k) => byKey[k])}
                        </div>
                        <div className={`mt-3 text-[13px] text-neutral-800 ${plexMono.className}`}>
                          {w.days} days × {formatMoney(w.myCostPerDay)} ={" "}
                          <span className="font-semibold">
                            {formatMoney(Math.max(0, w.days) * Math.max(0, w.myCostPerDay))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addWorker}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 border-dashed text-[13px] font-semibold"
                    style={{ borderColor: SITE.border, color: SITE.ink }}
                  >
                    + Add worker
                  </button>
                </div>
              ) : null}
            </div>

            <div style={cardStyle} className="overflow-hidden">
              <div className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 py-2 text-left"
                  onClick={() => update({ wasteDisposalEnabled: !d.wasteDisposalEnabled })}
                >
                  <div className="text-[13px] font-semibold text-neutral-900">Waste / disposal</div>
                  <div className="text-[12px] text-[#888]">
                    Dumpster, bags, hazmat — pass to client
                  </div>
                </button>
                <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <SiteSwitch
                    on={d.wasteDisposalEnabled}
                    onChange={(wasteDisposalEnabled) => update({ wasteDisposalEnabled })}
                  />
                </span>
              </div>
              {d.wasteDisposalEnabled ? (
                <div className="border-t px-3 py-3" style={{ borderColor: SITE.border }}>
                  <label className="block">
                    <span className={sectionLabelCls}>Disposal amount (your cost)</span>
                    <div
                      className="mt-1 flex min-h-[44px] items-center gap-2 rounded-lg border bg-white px-3"
                      style={{ borderColor: SITE.border }}
                    >
                      <span className="text-[#888]">$</span>
                      <input
                        type="number"
                        min={0}
                        className={`min-h-[44px] w-full flex-1 bg-transparent text-[13px] outline-none ${plexMono.className}`}
                        value={d.wasteDisposalAmount || ""}
                        onChange={(e) =>
                          update({
                            wasteDisposalAmount: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </div>
                  </label>
                </div>
              ) : null}
            </div>

            <div style={cardStyle} className="overflow-hidden">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between px-3 text-left"
                onClick={() => setScopeOpen((o) => !o)}
              >
                <span className="text-[13px] font-semibold text-neutral-900">
                  Scope &amp; site checks
                </span>
                <span className="text-[#888]">{scopeOpen ? "▾" : "▸"}</span>
              </button>
              {scopeOpen ? (
                <div className="space-y-4 border-t px-3 py-3" style={{ borderColor: SITE.border }}>
                  <div>
                    <div className={sectionLabelCls}>From room</div>
                    <div className="mt-1 text-[13px] font-medium">{dimsLine}</div>
                    {sqFt > 0 ? (
                      <div className={`mt-1 text-[15px] font-semibold ${monoNum}`}>{sqFt} sq ft</div>
                    ) : (
                      <p className="mt-1 text-[13px] text-[#888]">
                        Add room dimensions for square footage.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className={sectionLabelCls}>Scope</div>
                    <div className="mt-2 flex flex-col gap-2">
                      {(["full", "selective"] as DemoScope[]).map((s) => {
                        const on = d.scope === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => update({ scope: s })}
                            className="min-h-[44px] w-full rounded-lg px-3 text-left text-[13px] font-semibold"
                            style={{
                              border: `0.5px solid ${SITE.border}`,
                              background: on ? SITE.ink : SITE.white,
                              color: on ? SITE.white : SITE.muted,
                              borderRadius: 8,
                            }}
                          >
                            {s === "full" ? "Full gut" : "Selective"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">What&apos;s coming out</div>
                    <ul
                      className="mt-2 overflow-hidden rounded-lg border bg-white"
                      style={{ borderColor: SITE.border }}
                    >
                      {DEMOLITION_CHECKLIST.map(({ key, label }) => {
                        const on = !!d.checklist[key];
                        return (
                          <li
                            key={key}
                            className="flex min-h-[44px] items-center justify-between gap-3 border-t px-3 py-2 first:border-t-0"
                            style={{ borderColor: SITE.border }}
                          >
                            <span className="text-[13px]">{label}</span>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleChecklist(key)}
                              className="min-h-[44px] min-w-[44px] rounded-lg text-[15px] font-bold"
                              style={{
                                border: `0.5px solid ${SITE.border}`,
                                background: on ? SITE.yellow : SITE.white,
                                color: SITE.ink,
                              }}
                            >
                              {on ? "✓" : ""}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: SITE.border, background: SITE.white }}
                  >
                    <div className="flex min-h-[44px] items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold">Hazmat present</div>
                        <div className="text-[12px] text-[#888]">Asbestos, lead, mold</div>
                      </div>
                      <SiteSwitch on={d.hazmat} onChange={(hazmat) => update({ hazmat })} />
                    </div>
                  </div>
                  <div
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: SITE.border, background: SITE.white }}
                  >
                    <div className="flex min-h-[44px] items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold">Dumpster needed</div>
                        <div className="text-[12px] text-[#888]">Site logistics flag</div>
                      </div>
                      <SiteSwitch on={d.dumpster} onChange={(dumpster) => update({ dumpster })} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "materials" && (
          <div className="min-w-0">
            {productsErr ? <p className="text-[13px] text-red-700">{productsErr}</p> : null}
            {!productsErr && products.length === 0 ? (
              <p className="text-[13px] text-[#888]">No products found</p>
            ) : (
              grouped.order.map((sub) => (
                <section key={sub} className="mb-6">
                  <h3 className={`mb-2 ${sectionLabelCls}`}>{sub}</h3>
                  <ul style={cardStyle} className="bg-white px-2 py-1">
                    {grouped.map.get(sub)!.map((p, pi) => (
                      <li
                        key={p.id}
                        className="flex min-w-0 gap-3 py-3"
                        style={{
                          borderTop: pi === 0 ? undefined : `0.5px solid ${SITE.border}`,
                        }}
                      >
                        <div
                          className="relative h-[120px] w-[120px] shrink-0 overflow-hidden bg-neutral-100"
                          style={{ borderRadius: 8 }}
                        >
                          {p.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnail}
                              alt=""
                              width={120}
                              height={120}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          {p.brand ? (
                            <div className={sectionLabelCls}>{p.brand}</div>
                          ) : null}
                          <div className="text-[13px] font-medium leading-snug">{p.title ?? "—"}</div>
                          <div className={`mt-0.5 text-[15px] font-medium ${plexMono.className}`} style={{ color: SITE.green }}>
                            {p.price != null ? String(p.price) : "—"}
                          </div>
                        </div>
                        <MatQtyStepper
                          value={d.materialQty[String(p.id)] ?? 0}
                          onChange={(q) =>
                            update({
                              materialQty: { ...d.materialQty, [String(p.id)]: q },
                            })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}

        {tab === "totals" && (
          <div className="flex min-w-0 flex-col gap-5 text-[13px]">
            <section
              className="px-3 py-3"
              style={{
                border: `0.5px solid ${SITE.myCostsBorder}`,
                borderRadius: 8,
                background: SITE.cardBg,
              }}
            >
              <div className={`mb-2 flex items-center gap-2 ${sectionLabelCls}`}>
                <span className="h-2 w-2 shrink-0 rounded-full bg-black" aria-hidden />
                MY COSTS — PRIVATE
              </div>
              {d.labourCostMode === "job" ? (
                <div className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>Labour (per job)</span>
                  <span className={`shrink-0 ${monoNum}`}>{formatMoney(d.myLabourPerJob)}</span>
                </div>
              ) : d.workerExpenseEnabled ? (
                d.workers.map((w, idx) => (
                  <div key={w.id} className="flex justify-between gap-2 py-1 text-neutral-800">
                    <span>
                      {workerSlotLabel(w, idx)} — {w.days} days × {formatMoney(w.myCostPerDay)}
                    </span>
                    <span className={`shrink-0 ${monoNum}`}>
                      {formatMoney(w.days * w.myCostPerDay)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>Labour</span>
                  <span className={`shrink-0 ${monoNum}`}>{formatMoney(0)}</span>
                </div>
              )}
              <div className="flex justify-between gap-2 py-1 text-neutral-800">
                <span>Materials</span>
                <span className={`shrink-0 ${monoNum}`}>{formatMoney(materialMyCost)}</span>
              </div>
              {d.wasteDisposalEnabled ? (
                <div className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>Waste / disposal</span>
                  <span className={`shrink-0 ${monoNum}`}>{formatMoney(d.wasteDisposalAmount)}</span>
                </div>
              ) : null}
              <div
                className="mt-2 flex justify-between gap-2 rounded-lg px-2 py-3 font-bold text-neutral-900"
                style={{ background: SITE.myCostsTotalBg }}
              >
                <span>Total my cost</span>
                <span className={`${plexMono.className} text-[18px] font-semibold tabular-nums`}>
                  {formatMoney(myCostsTotal)}
                </span>
              </div>
            </section>

            <section
              className="px-3 py-3"
              style={{
                border: `0.5px solid ${SITE.green}`,
                borderRadius: 8,
                background: SITE.white,
              }}
            >
              <div className={`mb-2 flex items-center gap-2 font-semibold ${sectionLabelCls}`} style={{ color: SITE.green }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE.green }} aria-hidden />
                CLIENT INVOICE — VISIBLE ON QUOTE
              </div>
              <label className="block">
                <span className="text-[13px] text-[#888]">Labour charge to client</span>
                <div
                  className="mt-1 flex min-h-[44px] items-center gap-2 rounded-lg border px-3"
                  style={{ borderColor: SITE.border }}
                >
                  <span className="text-[#888]">$</span>
                  <input
                    type="number"
                    min={0}
                    className={`min-h-[44px] w-full flex-1 bg-transparent text-[13px] outline-none ${plexMono.className}`}
                    value={d.clientLabourCharge || ""}
                    onChange={(e) =>
                      update({ clientLabourCharge: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
              </label>
              <div className="mt-3 flex min-h-[44px] flex-wrap items-center gap-2">
                <span className="text-[13px] text-[#888]">Materials markup</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  className={`min-h-[44px] w-16 rounded-lg border px-2 text-center text-[13px] outline-none ${plexMono.className}`}
                  style={{ borderColor: SITE.border }}
                  value={d.clientMaterialsMarkupPct}
                  onChange={(e) =>
                    update({
                      clientMaterialsMarkupPct: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
                <span className="text-[13px]">%</span>
              </div>
              <div className="mt-1 flex justify-between gap-2 text-neutral-800">
                <span>Materials to client</span>
                <span className={`shrink-0 font-medium ${monoNum}`} style={{ color: SITE.green }}>
                  {formatMoney(clientMaterialsCharge)}
                </span>
              </div>
              {d.wasteDisposalEnabled ? (
                <div className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>Waste / disposal (pass-through)</span>
                  <span className={`shrink-0 ${monoNum}`} style={{ color: SITE.green }}>
                    {formatMoney(clientWastePass)}
                  </span>
                </div>
              ) : null}
              <div
                className="mt-3 flex justify-between gap-2 rounded-lg px-2 py-4 font-bold"
                style={{ background: SITE.greenTint, color: SITE.green }}
              >
                <span className="text-[13px] uppercase tracking-wide">Total quote</span>
                <span className={`${plexMono.className} text-[22px] font-semibold tabular-nums`}>
                  {formatMoney(clientTotal)}
                </span>
              </div>
            </section>

            <section
              className="px-3 py-3"
              style={{
                border: `0.5px solid ${SITE.yellow}`,
                borderRadius: 8,
                background: SITE.profitBg,
              }}
            >
              <div
                className={`mb-2 flex items-center gap-2 font-semibold ${sectionLabelCls}`}
                style={{ color: SITE.profitLabel }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE.yellow }} aria-hidden />
                MY PROFIT
              </div>
              <div className="flex justify-between gap-2 py-1" style={{ color: "#422006" }}>
                <span>Profit</span>
                <span className={`font-semibold ${monoNum}`}>{formatMoney(profit)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1" style={{ color: "#422006" }}>
                <span>Profit / sq ft</span>
                <span className={`font-semibold ${monoNum}`}>{formatMoney(profitPerSq)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1" style={{ color: "#422006" }}>
                <span>Profit / hr (crew hours)</span>
                <span className={`font-semibold ${monoNum}`}>{formatMoney(profitPerHr)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1" style={{ color: "#422006" }}>
                <span>Margin</span>
                <span className={`font-semibold ${monoNum}`}>{marginPct}%</span>
              </div>
              <p className="mt-2 text-[13px] leading-snug" style={{ color: "#422006" }}>
                Interior demo typically $2–$7/sq ft. Your rate: {formatMoney(clientRatePerSq)}/sq ft
              </p>
            </section>
          </div>
        )}

        {tab === "timeline" && (
          <div className="flex min-w-0 flex-col gap-4">
            <div style={cardStyle} className="px-3 py-3">
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 py-2 text-left"
                  onClick={() => update({ scheduleTradeEnabled: !d.scheduleTradeEnabled })}
                >
                  <div className="text-[13px] font-semibold">Schedule this trade</div>
                  <div className="text-[12px] text-[#888]">Plan days on site</div>
                </button>
                <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <SiteSwitch
                    on={d.scheduleTradeEnabled}
                    onChange={(scheduleTradeEnabled) => update({ scheduleTradeEnabled })}
                  />
                </span>
              </div>
              {d.scheduleTradeEnabled ? (
                <div className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: SITE.border }}>
                  <div>
                    <div className={sectionLabelCls}>Total days</div>
                    <DaysStepperLarge value={d.timelineTotalDays} onChange={setTimelineDays} />
                  </div>
                  <div className="space-y-3">
                    {d.timelineDayDescriptions.map((note, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-lg border bg-white"
                        style={{ borderColor: SITE.border }}
                      >
                        <div
                          className="px-3 py-2 text-[13px] font-semibold"
                          style={{ background: SITE.subtleBg, color: SITE.muted }}
                        >
                          Day {i + 1}
                        </div>
                        <textarea
                          className="min-h-[44px] w-full resize-y border-t px-3 py-3 text-[13px] outline-none"
                          style={{ borderColor: SITE.border }}
                          placeholder="What happens this day…"
                          rows={2}
                          value={note}
                          onChange={(e) => setDayNote(i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={pushCalendar}
                    className="min-h-[44px] w-full rounded-lg text-[13px] font-semibold text-white"
                    style={{ background: SITE.ink }}
                  >
                    Push to Calendar
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SiteSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative h-8 min-h-[44px] w-[52px] min-w-[52px] shrink-0 self-center rounded-full transition-colors"
      style={{ background: on ? SITE.ink : "#cccccc" }}
    >
      <span
        className="absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white shadow transition-transform"
        style={{ left: on ? "calc(100% - 1.85rem)" : "0.2rem" }}
      />
    </button>
  );
}

function DaysStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      className="mt-1 flex min-h-[44px] w-full max-w-full items-stretch overflow-hidden"
      style={{ border: `0.5px solid ${SITE.border}`, borderRadius: 8 }}
    >
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-lg font-semibold"
        style={{ color: SITE.ink }}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <div
        className={`flex min-w-0 flex-1 items-center justify-center text-[15px] font-semibold tabular-nums ${plexMono.className}`}
      >
        {value}
      </div>
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-lg font-semibold"
        style={{ color: SITE.ink }}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function DaysStepperLarge({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      className="mt-2 flex min-h-[44px] w-full items-stretch overflow-hidden"
      style={{ border: `0.5px solid ${SITE.border}`, borderRadius: 8 }}
    >
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-xl font-semibold"
        style={{ color: SITE.ink }}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <div
        className={`flex flex-1 items-center justify-center text-[18px] font-semibold tabular-nums ${plexMono.className}`}
      >
        {value}
      </div>
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-xl font-semibold"
        style={{ color: SITE.ink }}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function MatQtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div
      className="flex h-[44px] w-[118px] shrink-0 items-stretch overflow-hidden"
      style={{ border: `0.5px solid ${SITE.border}`, borderRadius: 8 }}
    >
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-lg font-medium"
        style={{ color: SITE.ink }}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <div
        className={`flex flex-1 items-center justify-center text-[15px] font-semibold tabular-nums ${plexMono.className}`}
      >
        {value}
      </div>
      <button
        type="button"
        className="min-h-[44px] min-w-[44px] text-lg font-medium"
        style={{ color: SITE.ink }}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
