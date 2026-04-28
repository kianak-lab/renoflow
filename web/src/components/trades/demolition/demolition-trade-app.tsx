"use client";

import { IBM_Plex_Sans } from "next/font/google";
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
  totalLabourHours,
} from "@/lib/demolition-calculations";
import {
  applyDemolitionToTrade,
  DEMOLITION_CHECKLIST,
  type CachedProductRow,
  type DemoChecklistKey,
  type DemoScope,
  type DemoWorker,
  type DemolitionV3State,
  DEMOLITION_DEFAULT_STATE,
  clientLabourBillable,
  getDemolitionStateFromTrade,
  loadWorkspace,
  myLabourCost,
  readActiveProjectId,
  saveWorkspace,
} from "@/lib/demolition-workspace";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const YELLOW = "#FFE000";
const PRICE_GREEN = "#1a5c2e";
const MUTED = "#6b7280";
const LINE = "rgba(0,0,0,0.14)";

type TabKey = "calculator" | "materials" | "labour" | "totals";

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

  const [tab, setTab] = useState<TabKey>("calculator");
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

  const labourMyCost = useMemo(() => myLabourCost(d.workers), [d.workers]);
  const labourClientBillable = useMemo(
    () => clientLabourBillable(d.workers),
    [d.workers],
  );

  const myCostsTotal = labourMyCost + materialMyCost;

  const clientMaterialsCharge = useMemo(() => {
    const mk = 1 + Math.max(0, d.clientMaterialsMarkupPct) / 100;
    return Math.round(materialMyCost * mk * 100) / 100;
  }, [materialMyCost, d.clientMaterialsMarkupPct]);

  const clientTotal = useMemo(() => {
    return Math.round((labourClientBillable + clientMaterialsCharge) * 100) / 100;
  }, [labourClientBillable, clientMaterialsCharge]);

  const profit = Math.round((clientTotal - myCostsTotal) * 100) / 100;
  const profitPerSq = sqFt > 0 ? Math.round((profit / sqFt) * 100) / 100 : 0;
  const hrs = totalLabourHours(d.workers);
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

  function pushTimeline() {
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

  function addWorker() {
    update((prev) => ({
      ...prev,
      workers: [
        ...prev.workers,
        {
          id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: "",
          days: 1,
          myCostPerDay: 200,
          clientRatePerDay: 450,
        },
      ],
    }));
  }

  function removeWorker(id: string) {
    update((prev) => {
      const next = prev.workers.filter((w) => w.id !== id);
      return {
        ...prev,
        workers: next.length ? next : prev.workers,
      };
    });
  }

  function patchWorker(id: string, patch: Partial<DemoWorker>) {
    update((prev) => ({
      ...prev,
      workers: prev.workers.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  const workerSlotLabel = (w: DemoWorker, idx: number) =>
    w.name.trim() || `Worker ${idx + 1}`;

  return (
    <div
      className={`${plex.className} fixed inset-0 z-[200] flex flex-col bg-white text-neutral-900`}
      style={{
        fontFamily: "var(--font-ibm-plex), system-ui, sans-serif",
        fontSize: "min(15px, 16px)",
        minHeight: "100dvh",
      }}
    >
      <header
        className="shrink-0 rounded-b-none pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ background: YELLOW }}
      >
        <div className="flex items-start gap-2 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={back}
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center text-2xl font-semibold text-black"
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight text-black">Demolition</h1>
            <p className="mt-0.5 text-[13px] leading-snug" style={{ color: MUTED }}>
              Structure · {roomName}
              {sqFt > 0 ? ` · ${sqFt} sq ft` : ceilingFt > 0 ? ` · ${ceilingFt} ft ceiling` : ""}
            </p>
          </div>
        </div>
      </header>

      <div
        className="shrink-0 overflow-x-auto bg-white px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ borderBottom: `0.5px solid ${LINE}` }}
      >
        <div className="flex w-max min-w-full gap-2 pb-0.5">
          {(
            [
              ["calculator", "Calculator"],
              ["materials", "Materials"],
              ["labour", "Labour"],
              ["totals", "Totals"],
            ] as const
          ).map(([k, label]) => {
            const on = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="min-h-[44px] shrink-0 px-4 text-[13px] font-semibold transition-colors"
                style={{
                  borderRadius: 100,
                  background: on ? YELLOW : "#e5e7eb",
                  color: on ? "#000" : MUTED,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {!projectId ? (
          <p className="text-[13px]" style={{ color: MUTED }}>
            Open Demolition from a project room in RenoFlow so your work saves to the active job.
          </p>
        ) : null}

        {tab === "calculator" && (
          <div className="flex flex-col gap-5">
            <div
              className="rounded-xl px-4 py-4"
              style={{ background: "#f3f4f6", border: `0.5px solid ${LINE}` }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                From room
              </div>
              <div className="mt-1 text-[13px] font-medium text-neutral-800">{dimsLine}</div>
              {sqFt > 0 ? (
                <div className="mt-2 text-2xl font-bold tabular-nums text-black">{sqFt} sq ft</div>
              ) : (
                <div className="mt-2 text-[13px]" style={{ color: MUTED }}>
                  Add room dimensions in the room editor for square footage.
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Scope
              </div>
              <div className="flex w-full flex-col gap-2">
                {(["full", "selective"] as DemoScope[]).map((s) => {
                  const on = d.scope === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update({ scope: s })}
                      className="min-h-[48px] w-full rounded-xl px-4 text-left text-[13px] font-semibold"
                      style={{
                        border: on ? "none" : `1px solid ${LINE}`,
                        background: on ? "#000" : "#fff",
                        color: on ? "#fff" : MUTED,
                      }}
                    >
                      {s === "full" ? "Full gut" : "Selective"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-neutral-900">What&apos;s coming out</div>
              <ul className="flex flex-col gap-0 rounded-xl border border-neutral-200 bg-white">
                {DEMOLITION_CHECKLIST.map(({ key, label }) => {
                  const on = !!d.checklist[key];
                  return (
                    <li
                      key={key}
                      className="flex min-h-[44px] items-center justify-between gap-3 border-t border-neutral-100 px-3 py-2 first:border-t-0"
                    >
                      <span className="text-[13px] text-neutral-900">{label}</span>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleChecklist(key)}
                        className="flex h-9 min-w-[44px] items-center justify-center rounded-lg text-[15px] font-bold"
                        style={{
                          border: `1px solid ${on ? "#000" : LINE}`,
                          background: on ? YELLOW : "#fff",
                          color: "#000",
                        }}
                      >
                        {on ? "✓" : ""}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border px-3 py-3" style={{ borderColor: LINE }}>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">Hazmat present</div>
                  <div className="text-[13px]" style={{ color: MUTED }}>
                    Asbestos, lead, mold — client pays
                  </div>
                </div>
                <Switch on={d.hazmat} onChange={(hazmat) => update({ hazmat })} />
              </div>
              {d.hazmat ? (
                <div
                  className="mt-2 rounded-lg border px-3 py-2 text-[13px] font-medium text-red-800"
                  style={{ borderColor: "#fecaca", background: "#fef2f2" }}
                >
                  Hazmat flagged — add remediation cost to client invoice
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border px-3 py-3" style={{ borderColor: LINE }}>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">Dumpster needed</div>
                  <div className="text-[13px]" style={{ color: MUTED }}>
                    Pass-through cost to client
                  </div>
                </div>
                <Switch on={d.dumpster} onChange={(dumpster) => update({ dumpster })} />
              </div>
            </div>

            <button
              type="button"
              onClick={pushTimeline}
              className="min-h-[48px] w-full rounded-xl bg-black px-4 text-[13px] font-semibold text-white"
            >
              Push to Timeline →
            </button>
          </div>
        )}

        {tab === "materials" && (
          <div>
            {productsErr ? <p className="text-[13px] text-red-700">{productsErr}</p> : null}
            {!productsErr && products.length === 0 ? (
              <p className="text-[13px]" style={{ color: MUTED }}>
                No products found
              </p>
            ) : (
              grouped.order.map((sub) => (
                <section key={sub} className="mb-6">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {sub}
                  </h3>
                  <ul>
                    {grouped.map.get(sub)!.map((p, pi) => (
                      <li
                        key={p.id}
                        className="flex gap-3 py-3"
                        style={{
                          borderTop: pi === 0 ? undefined : "0.5px solid rgba(0,0,0,0.12)",
                        }}
                      >
                        <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden bg-neutral-100" style={{ borderRadius: 8 }}>
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
                            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                              {p.brand}
                            </div>
                          ) : null}
                          <div className="text-[13px] font-medium leading-snug">{p.title ?? "—"}</div>
                          <div className="text-[14px] font-medium" style={{ color: PRICE_GREEN }}>
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

        {tab === "labour" && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={addWorker}
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-neutral-50 text-[13px] font-semibold text-neutral-900"
            >
              + Add Worker
            </button>
            {d.workers.map((w, idx) => (
              <div
                key={w.id}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: LINE }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <input
                    className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 px-3 text-[13px] outline-none"
                    placeholder={workerSlotLabel(w, idx)}
                    value={w.name}
                    onChange={(e) => patchWorker(w.id, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-lg text-neutral-600"
                    onClick={() => removeWorker(w.id)}
                    aria-label="Remove worker"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px]" style={{ color: MUTED }}>
                    Days
                  </span>
                  <DaysStepper
                    value={w.days}
                    onChange={(days) => patchWorker(w.id, { days })}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="text-[12px] font-semibold leading-snug text-neutral-800">
                      My cost per day
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: MUTED }}>
                      What you pay this worker — private, never shown to the client
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[13px]">$</span>
                      <input
                        type="number"
                        min={0}
                        className="min-h-[44px] w-full min-w-[8rem] flex-1 rounded-lg border border-neutral-200 px-3 text-[13px] outline-none"
                        value={w.myCostPerDay || ""}
                        onChange={(e) =>
                          patchWorker(w.id, {
                            myCostPerDay: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                      <span className="text-[12px]" style={{ color: MUTED }}>
                        /day
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-semibold leading-snug text-neutral-800">
                      Client rate per day
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: MUTED }}>
                      What you charge the client for this worker — appears on quote / invoice
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[13px]">$</span>
                      <input
                        type="number"
                        min={0}
                        className="min-h-[44px] w-full min-w-[8rem] flex-1 rounded-lg border border-neutral-200 px-3 text-[13px] outline-none"
                        value={w.clientRatePerDay || ""}
                        onChange={(e) =>
                          patchWorker(w.id, {
                            clientRatePerDay: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                      <span className="text-[12px]" style={{ color: MUTED }}>
                        /day
                      </span>
                    </div>
                  </label>
                </div>
                <div className="mt-3 space-y-1 border-t border-neutral-100 pt-2 text-[13px]">
                  <div className="flex justify-between gap-2 font-medium text-neutral-800">
                    <span>My cost (this worker)</span>
                    <span>
                      {formatMoney(Math.max(0, w.days) * Math.max(0, w.myCostPerDay))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold" style={{ color: PRICE_GREEN }}>
                    <span>Client labour (this worker)</span>
                    <span>
                      {formatMoney(Math.max(0, w.days) * Math.max(0, w.clientRatePerDay))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div
              className="space-y-2 rounded-xl border px-3 py-3 text-[13px]"
              style={{ borderColor: LINE }}
            >
              <div className="flex justify-between gap-2 font-semibold text-neutral-800">
                <span>Total my labour cost (private)</span>
                <span>{formatMoney(labourMyCost)}</span>
              </div>
              <div className="flex justify-between gap-2 font-semibold" style={{ color: PRICE_GREEN }}>
                <span>Total client labour (quote)</span>
                <span>{formatMoney(labourClientBillable)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "totals" && (
          <div className="flex flex-col gap-5 text-[13px]">
            <section
              className="rounded-xl border-2 border-neutral-800 bg-neutral-100 px-3 py-3"
              style={{ borderColor: "#111" }}
            >
              <div className="mb-2 flex items-center gap-2 font-bold text-neutral-900">
                <span className="inline-block h-2 w-2 rounded-full bg-black" aria-hidden />
                MY COSTS — PRIVATE
              </div>
              {d.workers.map((w, idx) => (
                <div key={w.id} className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>
                    {workerSlotLabel(w, idx)} — {w.days} days × {formatMoney(w.myCostPerDay)}{" "}
                    <span className="text-[11px] text-neutral-500">(my cost/day)</span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(w.days * w.myCostPerDay)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between gap-2 py-1 text-neutral-800">
                <span>Materials</span>
                <span className="font-medium">{formatMoney(materialMyCost)}</span>
              </div>
              <div
                className="mt-2 flex justify-between gap-2 rounded-lg px-2 py-2 text-[15px] font-bold"
                style={{ background: "rgba(0,0,0,0.08)" }}
              >
                <span>Total my cost</span>
                <span>{formatMoney(myCostsTotal)}</span>
              </div>
            </section>

            <section className="rounded-xl border-2 border-green-700 bg-white px-3 py-3" style={{ borderColor: "#166534" }}>
              <div className="mb-2 flex items-center gap-2 font-bold" style={{ color: "#166534" }}>
                <span className="inline-block h-2 w-2 rounded-full bg-green-600" aria-hidden />
                CLIENT INVOICE — VISIBLE ON QUOTE
              </div>
              <p className="mb-2 text-[11px] leading-snug text-neutral-600">
                Labour lines use each worker’s <strong>client rate per day</strong> from the Labour tab.
              </p>
              {d.workers.map((w, idx) => (
                <div key={w.id} className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>
                    {workerSlotLabel(w, idx)} — {w.days} days × {formatMoney(w.clientRatePerDay)}{" "}
                    <span className="text-[11px] text-neutral-500">(client rate/day)</span>
                  </span>
                  <span className="shrink-0 font-medium" style={{ color: PRICE_GREEN }}>
                    {formatMoney(w.days * w.clientRatePerDay)}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex justify-between gap-2 border-b border-green-100 pb-2 text-neutral-800">
                <span className="font-medium">Labour subtotal (client)</span>
                <span className="font-medium" style={{ color: PRICE_GREEN }}>
                  {formatMoney(labourClientBillable)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span style={{ color: MUTED }}>Materials + markup</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  className="min-h-[44px] w-20 rounded-lg border border-green-200 px-2 text-center text-[13px] outline-none"
                  value={d.clientMaterialsMarkupPct}
                  onChange={(e) =>
                    update({
                      clientMaterialsMarkupPct: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
                <span>%</span>
              </div>
              <div className="mt-1 flex justify-between gap-2 text-neutral-800">
                <span>Materials to client</span>
                <span className="font-medium" style={{ color: PRICE_GREEN }}>
                  {formatMoney(clientMaterialsCharge)}
                </span>
              </div>
              <div
                className="mt-3 flex justify-between gap-2 rounded-lg px-2 py-3 text-[16px] font-bold"
                style={{ background: "#dcfce7", color: "#166534" }}
              >
                <span>Total quote</span>
                <span>{formatMoney(clientTotal)}</span>
              </div>
            </section>

            <section
              className="rounded-xl border-2 px-3 py-3"
              style={{ borderColor: "#ca8a04", background: "#fffbe6" }}
            >
              <div className="mb-2 flex items-center gap-2 font-bold text-yellow-900">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" aria-hidden />
                MY PROFIT
              </div>
              <div className="flex justify-between gap-2 py-1 text-yellow-950">
                <span>Profit</span>
                <span className="font-semibold">{formatMoney(profit)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1 text-yellow-950">
                <span>Profit / sq ft</span>
                <span className="font-semibold">{formatMoney(profitPerSq)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1 text-yellow-950">
                <span>Profit / hr (crew hours)</span>
                <span className="font-semibold">{formatMoney(profitPerHr)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1 text-yellow-950">
                <span>Margin</span>
                <span className="font-semibold">{marginPct}%</span>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-yellow-950">
                Interior demo typically $2–$7/sq ft. Your rate: {formatMoney(clientRatePerSq)}/sq ft
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative h-8 w-14 shrink-0 rounded-full transition-colors"
      style={{ background: on ? YELLOW : "#d1d5db" }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{ left: on ? "calc(100% - 1.75rem)" : "0.25rem" }}
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
      className="flex h-9 items-stretch overflow-hidden"
      style={{ border: `0.5px solid ${LINE}`, borderRadius: 8 }}
    >
      <button
        type="button"
        className="min-h-[36px] w-11 text-lg font-semibold"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <div className="flex min-w-[2.5rem] flex-1 items-center justify-center text-[13px] font-semibold">
        {value}
      </div>
      <button
        type="button"
        className="min-h-[36px] w-11 text-lg font-semibold"
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
      className="flex h-[36px] w-[118px] shrink-0 items-stretch overflow-hidden"
      style={{ border: `0.5px solid ${LINE}`, borderRadius: 8 }}
    >
      <button
        type="button"
        className="w-11 text-lg font-medium"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <div className="flex flex-1 items-center justify-center text-[13px] font-semibold">{value}</div>
      <button type="button" className="w-11 text-lg font-medium" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
