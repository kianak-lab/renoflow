"use client";

import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ceilingFtFromDims,
  floorSqFtFromDims,
  formatMoney,
  parsePrice,
} from "@/lib/demolition-calculations";
import {
  applyDemolitionToTrade,
  clientLabourBilled,
  crewBillableHours,
  dayCostFromHourly,
  type CachedProductRow,
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

/** Same height so worker-grid controls (days / hourly / day rate) line up when labels wrap. */
const workerGridLabelSlotCls = "min-h-[2.75rem] flex items-end";

/** Hide native number spinners (often render as dark blocks on mobile). */
const noSpinner =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

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

export type DemolitionTradeAppProps = {
  /** URL query `pid` from server render — anchors SPA transitions before client search params sync */
  initialPid?: string;
  /** URL query `dbRoomId` from server render */
  initialDbRoomId?: string;
};

export default function DemolitionTradeApp(props: DemolitionTradeAppProps = {}) {
  const { initialPid = "", initialDbRoomId = "" } = props;
  const router = useRouter();
  const sp = useSearchParams();
  /** Fallback when Next.js client router hasn't surfaced query strings yet (common after SPA navigation). */
  const [locPid, setLocPid] = useState("");
  const [locDbRoomId, setLocDbRoomId] = useState("");
  const searchSig = sp.toString();
  useLayoutEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      setLocPid((q.get("pid") ?? "").trim());
      setLocDbRoomId((q.get("dbRoomId") ?? "").trim());
    } catch {
      /* ignore */
    }
  }, [searchSig]);

  const pidParam =
    (sp.get("pid") ?? "").trim() ||
    initialPid.trim() ||
    locPid.trim() ||
    undefined;
  const dbRoomIdParam =
    (sp.get("dbRoomId") ?? "").trim() ||
    initialDbRoomId.trim() ||
    locDbRoomId.trim() ||
    "";

  const riParam = Number(sp.get("ri") ?? "0");
  const tiParam = Number(sp.get("ti") ?? "0");

  const [tab, setTab] = useState<TabKey>("labour");
  const [materialSearch, setMaterialSearch] = useState("");
  const [totalsMyOpen, setTotalsMyOpen] = useState(false);
  const [totalsProfitOpen, setTotalsProfitOpen] = useState(false);
  const [products, setProducts] = useState<CachedProductRow[]>([]);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [d, setD] = useState<DemolitionV3State>(DEMOLITION_DEFAULT_STATE);
  const dRef = useRef(d);
  dRef.current = d;

  const projectId = pidParam || readActiveProjectId() || "";

  const { ri, ti } = useMemo(() => {
    const fallbackRi = Number.isFinite(riParam) && riParam >= 0 ? Math.floor(riParam) : 0;
    const fallbackTi = Number.isFinite(tiParam) && tiParam >= 0 ? Math.floor(tiParam) : 0;
    if (!projectId) return { ri: fallbackRi, ti: fallbackTi };
    const ws = loadWorkspace(projectId);
    const rooms = ws?.rooms ?? [];
    if (!rooms.length) return { ri: fallbackRi, ti: fallbackTi };
    let useRi =
      fallbackRi < rooms.length && fallbackRi >= 0 ? fallbackRi : 0;
    if (dbRoomIdParam) {
      const idx = rooms.findIndex(
        (r) => String((r as { dbRoomId?: string }).dbRoomId ?? "") === dbRoomIdParam,
      );
      if (idx >= 0) useRi = idx;
    }
    const rRoom = rooms[useRi];
    const trades = (rRoom?.trades ?? []) as Array<{ id?: string }>;
    let useTi =
      fallbackTi < trades.length && fallbackTi >= 0 ? fallbackTi : 0;
    const demoI = trades.findIndex((t) => String(t.id ?? "") === "demo");
    if (demoI >= 0) useTi = demoI;
    return { ri: useRi, ti: useTi };
  }, [projectId, riParam, tiParam, dbRoomIdParam]);

  const room = useMemo(() => {
    if (!projectId) return null;
    const ws = loadWorkspace(projectId);
    return ws?.rooms?.[ri] ?? null;
  }, [projectId, ri]);

  const roomName = room?.n ?? "Room";
  const dims = room?.d as Record<string, unknown> | undefined;
  const sqFt = useMemo(() => floorSqFtFromDims(dims), [dims]);
  const ceilingFt = useMemo(() => ceilingFtFromDims(dims), [dims]);
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
    if (typeof window === "undefined") return;
    const ws = projectId ? loadWorkspace(projectId) : null;
    console.log("[RF demolition] URL params", {
      pid_sp: sp.get("pid"),
      dbRoomId_sp: sp.get("dbRoomId"),
      initialPidProp: initialPid,
      initialDbRoomIdProp: initialDbRoomId,
      locPid,
      locDbRoomId,
      mergedPid: pidParam ?? null,
      mergedDbRoomId: dbRoomIdParam || null,
      projectIdResolved: projectId || null,
      activeProjectFallback: readActiveProjectId(),
    });
    console.log(
      "[RF demolition] loadWorkspace(" + (projectId || "(empty)") + ")",
      ws == null
        ? ws
        : {
            topKeys: ws && typeof ws === "object" ? Object.keys(ws) : [],
            roomsLength: ws?.rooms?.length ?? 0,
            roomSummaries: ws?.rooms?.map((r, i) => ({
              i,
              n: r?.n,
              dbRoomId: r?.dbRoomId,
              tradesCount: r?.trades?.length ?? 0,
              tradeIds: (r?.trades ?? []).map((t) => (t as { id?: string }).id),
            })),
          },
    );
  }, [
    projectId,
    sp,
    searchSig,
    initialPid,
    initialDbRoomId,
    locPid,
    locDbRoomId,
    pidParam,
    dbRoomIdParam,
  ]);

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

  const pushToQuote = useCallback(async () => {
    if (!projectId) return;
    persistLocal(dRef.current);
    await persistRemote(dRef.current);
    try {
      localStorage.setItem("rf7_active_project", projectId);
    } catch {
      /* quota / private mode */
    }
    const dbRoomIdSnap =
      dbRoomIdParam || String((room as { dbRoomId?: string } | null)?.dbRoomId ?? "");
    try {
      sessionStorage.setItem(
        "rf_quote_return",
        JSON.stringify({
          ri,
          ti,
          ...(dbRoomIdSnap ? { dbRoomId: dbRoomIdSnap } : {}),
        }),
      );
    } catch {
      /* private mode / quota */
    }
    router.push(`/final?project=${encodeURIComponent(projectId)}&pg=quote`);
  }, [projectId, persistLocal, persistRemote, router, ri, ti, dbRoomIdParam, room]);

  const pushTimelineToQuote = useCallback(() => {
    if (!projectId || !dRef.current.scheduleTradeEnabled) return;
    const base = { ...dRef.current, timelineDescriptionsOnQuote: true, v: 3 as const };
    const next = { ...base, clientLabourCharge: clientLabourBilled(base) };
    persistLocal(next);
    void persistRemote(next);
    setD(next);
  }, [projectId, persistLocal, persistRemote]);

  const debouncedLocal = useDebouncedFn(persistLocal, 280);
  const debouncedRemote = useDebouncedFn(
    useCallback((next: DemolitionV3State) => void persistRemote(next), [persistRemote]),
    600,
  );

  const update = useCallback(
    (patch: Partial<DemolitionV3State> | ((prev: DemolitionV3State) => DemolitionV3State)) => {
      setD((prev) => {
        const base = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        const merged = { ...base, v: 3 as const };
        const next = { ...merged, clientLabourCharge: clientLabourBilled(merged) };
        debouncedLocal(next);
        debouncedRemote(next);
        if (typeof patch === "object" && patch !== null && "materialsBillToClient" in patch) {
          persistLocal(next);
        }
        return next;
      });
    },
    [debouncedLocal, debouncedRemote, persistLocal],
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
  const clientLabourTotal = useMemo(() => clientLabourBilled(d), [d]);
  const wasteMy = useMemo(() => myWasteCost(d), [d]);

  const myCostsTotal = labourMyCost + materialMyCost + wasteMy;

  const clientMaterialsCharge = useMemo(() => {
    if (!d.materialsBillToClient) return 0;
    const mk = 1 + Math.max(0, d.clientMaterialsMarkupPct) / 100;
    return Math.round(materialMyCost * mk * 100) / 100;
  }, [materialMyCost, d.clientMaterialsMarkupPct, d.materialsBillToClient]);

  const clientWastePass = d.wasteDisposalEnabled ? Math.round(d.wasteDisposalAmount * 100) / 100 : 0;

  const clientTotal = useMemo(() => {
    return Math.round((clientLabourTotal + clientMaterialsCharge + clientWastePass) * 100) / 100;
  }, [clientLabourTotal, clientMaterialsCharge, clientWastePass]);

  const profit = Math.round((clientTotal - myCostsTotal) * 100) / 100;
  const profitPerSq = sqFt > 0 ? Math.round((profit / sqFt) * 100) / 100 : 0;
  const hrs = useMemo(() => crewBillableHours(d), [d]);
  const profitPerHr = hrs > 0 ? Math.round((profit / hrs) * 100) / 100 : 0;
  const marginPct = clientTotal > 0 ? Math.round((profit / clientTotal) * 1000) / 10 : 0;
  const clientRatePerSq = sqFt > 0 ? Math.round((clientTotal / sqFt) * 100) / 100 : 0;

  const filteredProducts = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const title = (p.title ?? "").toLowerCase();
      const brand = (p.brand ?? "").toLowerCase();
      const sub = (p.subsection ?? "").toLowerCase();
      return title.includes(q) || brand.includes(q) || sub.includes(q);
    });
  }, [products, materialSearch]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, CachedProductRow[]>();
    for (const p of filteredProducts) {
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
  }, [filteredProducts]);

  function back() {
    if (projectId) persistLocal(dRef.current);
    const pid = pidParam?.trim() ?? "";
    const dbRoom = dbRoomIdParam?.trim() ?? "";
    if (pid && dbRoom) {
      router.push(`/project/${encodeURIComponent(pid)}/room/${encodeURIComponent(dbRoom)}`);
      return;
    }
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

  function pushMaterialsList() {
    if (!projectId) return;
    persistLocal(dRef.current);
    const qs = new URLSearchParams();
    qs.set("pid", projectId);
    if (dbRoomIdParam) qs.set("dbRoomId", dbRoomIdParam);
    qs.set("ri", String(ri));
    qs.set("ti", String(ti));
    router.push(`/trades/demolition/materials-list?${qs.toString()}`);
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
    const day = dayCostFromHourly(h);
    update((prev) => ({
      ...prev,
      workers: prev.workers.map((w) =>
        w.id === id ? { ...w, hourlyMyCost: h, myCostPerDay: day } : w,
      ),
    }));
  }

  function setWorkerDayCost(id: string, dayCost: number) {
    const dc = Math.max(0, dayCost);
    const hr = hourlyFromDayCost(dc);
    update((prev) => ({
      ...prev,
      workers: prev.workers.map((w) =>
        w.id === id ? { ...w, myCostPerDay: dc, hourlyMyCost: hr } : w,
      ),
    }));
  }

  function parseMoneyInput(raw: string): number {
    if (raw === "" || raw === ".") return 0;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
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

  const headerSubtitle = useMemo(() => {
    const name = (roomName ?? "").trim() || "Room";
    const sqRounded = sqFt > 0 ? Math.round(sqFt) : 0;
    if (sqRounded > 0) {
      return `Structure · ${name} · ${sqRounded} sq ft`;
    }
    if (ceilingFt > 0) {
      return `Structure · ${name} · ${ceilingFt} ft ceiling`;
    }
    return `Structure · ${name}`;
  }, [roomName, sqFt, ceilingFt]);

  const workerSlotLabel = (w: DemoWorker, idx: number) =>
    w.name.trim() || `Worker ${idx + 1}`;

  const cardStyle = {
    background: SITE.cardBg,
    border: `0.5px solid ${SITE.border}`,
    borderRadius: 8,
  } as const;

  const cardPad = "px-[14px] py-[14px]";
  const bubbleRounded = "rounded-[8px]";

  const monoNum = `${plexMono.className} text-[14px] font-medium tabular-nums`;

  return (
    <div
      className={`${plexSans.className} fixed inset-0 z-[500] flex max-w-[100vw] flex-col overflow-x-hidden bg-white text-[13px] text-neutral-900 antialiased`}
      style={{
        minHeight: "100dvh",
        fontSize: 13,
      }}
    >
      <header className="shrink-0 rounded-none" style={{ background: SITE.yellow }}>
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
            <h1 className="text-[15px] font-medium leading-tight" style={{ color: SITE.ink }}>
              Demolition
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[#888]">{headerSubtitle}</p>
          </div>
        </div>
      </header>

      <div
        className="shrink-0 border-b bg-white py-2 pl-3 pr-2"
        style={{ borderColor: SITE.border }}
      >
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: 6 }}
        >
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
                className="min-h-[44px] shrink-0 px-5 text-center text-[13px] font-semibold transition-colors"
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
            <div style={cardStyle} className={cardPad}>
              <div className={sectionLabelCls}>Labour — client invoice</div>
              <h2 className="mt-1 text-[13px] font-semibold leading-snug text-neutral-900">
                Labour cost billed to client
              </h2>
              <p className="mt-1 text-[12px] leading-snug text-[#888]">
                This is what the client pays for labour on the quote. Your own crew cost is tracked in{" "}
                <strong>Worker expense</strong> below.
              </p>
              <div
                className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ gap: 6 }}
              >
                {(["job", "daily", "hourly"] as LabourCostMode[]).map((m) => {
                  const on = d.labourCostMode === m;
                  const label = m === "job" ? "Per job" : m === "daily" ? "Daily" : "Hourly";
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ labourCostMode: m })}
                      className="min-h-[44px] shrink-0 px-5 text-[13px] font-semibold"
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
                  <span className="text-[13px] text-neutral-800">Labour charge — flat per job (USD)</span>
                  <div
                    className={`mt-1 border bg-white ${bubbleRounded}`}
                    style={{ border: `0.5px solid ${SITE.border}` }}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      className={`min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                      value={d.myLabourPerJob}
                      onChange={(e) =>
                        update({ myLabourPerJob: parseMoneyInput(e.target.value) })
                      }
                    />
                  </div>
                </label>
              ) : d.labourCostMode === "daily" ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className={sectionLabelCls}>Billable days (client)</div>
                    <DaysStepper
                      value={d.myCostDailyDays}
                      onChange={(n) => update({ myCostDailyDays: n })}
                    />
                  </div>
                  <label className="block">
                    <span className="text-[13px] text-neutral-800">Client rate per day (USD)</span>
                    <div
                      className={`mt-1 border bg-white ${bubbleRounded}`}
                      style={{ border: `0.5px solid ${SITE.border}` }}
                    >
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        className={`min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                        value={d.myCostDailyRate}
                        onChange={(e) =>
                          update({ myCostDailyRate: parseMoneyInput(e.target.value) })
                        }
                      />
                    </div>
                  </label>
                  <div className={`text-[13px] text-neutral-800 ${plexMono.className}`}>
                    {d.myCostDailyDays} days × {formatMoney(d.myCostDailyRate)} ={" "}
                    <span className="font-semibold">
                      {formatMoney(d.myCostDailyDays * d.myCostDailyRate)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-[13px] text-neutral-800">Billable hours (client)</span>
                    <div
                      className={`mt-1 border bg-white ${bubbleRounded}`}
                      style={{ border: `0.5px solid ${SITE.border}` }}
                    >
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        className={`min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                        value={d.myCostHourlyHours}
                        onChange={(e) =>
                          update({ myCostHourlyHours: parseMoneyInput(e.target.value) })
                        }
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[13px] text-neutral-800">Client rate per hour (USD)</span>
                    <div
                      className={`mt-1 border bg-white ${bubbleRounded}`}
                      style={{ border: `0.5px solid ${SITE.border}` }}
                    >
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        className={`min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                        value={d.myCostHourlyRate}
                        onChange={(e) =>
                          update({ myCostHourlyRate: parseMoneyInput(e.target.value) })
                        }
                      />
                    </div>
                  </label>
                  <div className={`text-[13px] text-neutral-800 ${plexMono.className}`}>
                    {d.myCostHourlyHours} hrs × {formatMoney(d.myCostHourlyRate)} ={" "}
                    <span className="font-semibold">
                      {formatMoney(d.myCostHourlyHours * d.myCostHourlyRate)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={cardStyle} className="overflow-hidden">
              <div className={`flex min-h-[44px] w-full items-center justify-between gap-3 ${cardPad}`}>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[13px] font-semibold text-neutral-900">Worker expense</div>
                  <div className="text-[12px] text-[#888]">
                    Your real labour cost (private) — not shown on the client quote
                  </div>
                </div>
                <SiteSwitch
                  on={d.workerExpenseEnabled}
                  onChange={(workerExpenseEnabled) => update({ workerExpenseEnabled })}
                />
              </div>
              {d.workerExpenseEnabled ? (
                <div
                  className={`space-y-3 border-t px-[14px] pb-[14px] pt-2`}
                  style={{ borderColor: SITE.border }}
                >
                  <p className="text-[12px] leading-snug text-[#888]">
                    Day cost and hourly stay linked at 8 hrs/day. This grid is only for your internal
                    cost, not the client bill.
                  </p>
                  {d.workers.map((w, idx) => {
                    const colOrder = ["days", "day", "hourly"] as const;
                    const daysCol = (
                      <div key="days" className="flex min-w-0 flex-col">
                        <div className={workerGridLabelSlotCls}>
                          <div className={`${sectionLabelCls} leading-tight`}>Days</div>
                        </div>
                        <DaysStepper
                          value={w.days}
                          onChange={(days) => patchWorker(w.id, { days })}
                        />
                      </div>
                    );
                    const hourlyCol = (
                      <div key="hourly" className="flex min-w-0 flex-col">
                        <div className={workerGridLabelSlotCls}>
                          <div className={`${sectionLabelCls} leading-tight`}>
                            Hourly rate (USD)
                          </div>
                        </div>
                        <div
                          className={`mt-1 border bg-white ${bubbleRounded}`}
                          style={{ border: `0.5px solid ${SITE.border}` }}
                        >
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            className={`min-h-[44px] w-full bg-transparent px-2 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                            value={w.hourlyMyCost}
                            onChange={(e) =>
                              setWorkerHourly(w.id, parseMoneyInput(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    );
                    const dayCol = (
                      <div key="day" className="flex min-w-0 flex-col">
                        <div className={workerGridLabelSlotCls}>
                          <div className={`${sectionLabelCls} leading-tight`}>
                            Day rate (USD)
                          </div>
                        </div>
                        <div
                          className={`mt-1 border bg-white ${bubbleRounded}`}
                          style={{ border: `0.5px solid ${SITE.border}` }}
                        >
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            className={`min-h-[44px] w-full bg-transparent px-2 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                            value={w.myCostPerDay}
                            onChange={(e) =>
                              setWorkerDayCost(w.id, parseMoneyInput(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    );
                    const byKey = { days: daysCol, hourly: hourlyCol, day: dayCol };
                    return (
                      <div
                        key={w.id}
                        className={`border bg-white px-3 py-3 ${bubbleRounded}`}
                        style={{ border: `0.5px solid ${SITE.border}` }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            className={`min-h-[44px] min-w-0 flex-1 border px-2 text-[13px] outline-none ${bubbleRounded}`}
                            style={{ border: `0.5px solid ${SITE.border}` }}
                            placeholder={workerSlotLabel(w, idx)}
                            value={w.name}
                            onChange={(e) => patchWorker(w.id, { name: e.target.value })}
                          />
                          <button
                            type="button"
                            className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border text-lg ${bubbleRounded}`}
                            style={{ border: `0.5px solid ${SITE.border}` }}
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
                    className={`flex min-h-[44px] w-full items-center justify-center border-2 border-dashed text-[13px] font-semibold ${bubbleRounded}`}
                    style={{ borderColor: SITE.border, color: SITE.ink }}
                  >
                    + Add worker
                  </button>
                </div>
              ) : null}
            </div>

            <div style={cardStyle} className="overflow-hidden">
              <div className={`flex min-h-[44px] w-full items-center justify-between gap-3 ${cardPad}`}>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[13px] font-semibold text-neutral-900">Waste / disposal</div>
                  <div className="text-[12px] text-[#888]">
                    Dumpster, bags, hazmat — pass to client
                  </div>
                </div>
                <SiteSwitch
                  on={d.wasteDisposalEnabled}
                  onChange={(wasteDisposalEnabled) => update({ wasteDisposalEnabled })}
                />
              </div>
              {d.wasteDisposalEnabled ? (
                <div className={`border-t ${cardPad}`} style={{ borderColor: SITE.border }}>
                  <label className="block">
                    <span className={sectionLabelCls}>Disposal amount (your cost)</span>
                    <div
                      className={`mt-1 border bg-white ${bubbleRounded}`}
                      style={{ border: `0.5px solid ${SITE.border}` }}
                    >
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        className={`min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none ${noSpinner} ${plexMono.className}`}
                        value={d.wasteDisposalAmount}
                        onChange={(e) =>
                          update({
                            wasteDisposalAmount: parseMoneyInput(e.target.value),
                          })
                        }
                      />
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "materials" && (
          <div className="min-w-0">
            {productsErr ? <p className="text-[13px] text-red-700">{productsErr}</p> : null}
            {!productsErr && products.length > 0 ? (
              <div className="mb-4 space-y-3">
                <label className="block">
                  <span className={sectionLabelCls}>Search products</span>
                  <div
                    className={`mt-1 border bg-white ${bubbleRounded}`}
                    style={{ border: `0.5px solid ${SITE.border}` }}
                  >
                    <input
                      type="search"
                      autoComplete="off"
                      placeholder="Name, brand, or category"
                      className="min-h-[44px] w-full bg-transparent px-3 text-[13px] outline-none"
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                    />
                  </div>
                </label>
                <div style={cardStyle} className={cardPad}>
                  <div className={sectionLabelCls}>Who pays for materials</div>
                  <p className="mt-1 text-[12px] leading-snug text-[#888]">
                    Supplier subtotal for quantities below: {formatMoney(materialMyCost)}.{" "}
                    <strong>Private expense</strong> keeps materials in{" "}
                    <strong>MY COSTS — PRIVATE</strong> on Totals only — nothing is pushed to the client quote.{" "}
                    <strong>Client invoice</strong> bills the client (with markup on Totals) and those amounts appear on
                    the quote.
                  </p>
                  <div
                    className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ gap: 6 }}
                  >
                    <button
                      type="button"
                      onClick={() => update({ materialsBillToClient: false })}
                      className="min-h-[44px] shrink-0 px-4 text-[13px] font-semibold"
                      style={{
                        borderRadius: 100,
                        background: !d.materialsBillToClient ? SITE.yellow : SITE.subtleBg,
                        color: !d.materialsBillToClient ? SITE.ink : SITE.muted,
                      }}
                    >
                      Private expense
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ materialsBillToClient: true })}
                      className="min-h-[44px] shrink-0 px-4 text-[13px] font-semibold"
                      style={{
                        borderRadius: 100,
                        background: d.materialsBillToClient ? SITE.yellow : SITE.subtleBg,
                        color: d.materialsBillToClient ? SITE.ink : SITE.muted,
                      }}
                    >
                      Client invoice
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {!productsErr && products.length === 0 ? (
              <p className="text-[13px] text-[#888]">No products found</p>
            ) : !productsErr && filteredProducts.length === 0 ? (
              <p className="text-[13px] text-[#888]">No products match your search.</p>
            ) : (
              grouped.order.map((sub) => (
                <section key={sub} className="mb-6">
                  <h3 className={`mb-2 ${sectionLabelCls}`}>{sub}</h3>
                  <ul style={cardStyle} className={`bg-white ${cardPad}`}>
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
            {!productsErr && products.length > 0 ? (
              <button
                type="button"
                onClick={() => pushMaterialsList()}
                disabled={!projectId}
                className={`mt-6 min-h-[48px] w-full text-[14px] font-semibold text-white touch-manipulation disabled:opacity-45 ${bubbleRounded}`}
                style={{ background: SITE.ink }}
              >
                Push to Materials List
              </button>
            ) : null}
          </div>
        )}

        {tab === "totals" && (
          <div className="flex min-w-0 flex-col gap-5 text-[13px]">
            <section
              className={cardPad}
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
              <div className="block">
                <span className="text-[13px] text-[#888]">Labour billed to client</span>
                <div
                  className={`mt-1 flex min-h-[44px] items-center border bg-white px-3 ${bubbleRounded}`}
                  style={{ border: `0.5px solid ${SITE.border}` }}
                >
                  <span className={`text-[15px] font-medium ${plexMono.className}`} style={{ color: SITE.green }}>
                    {formatMoney(clientLabourTotal)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#888]">
                  Edit on the <strong>Labour</strong> tab under &quot;Labour cost billed to client&quot;.
                </p>
              </div>
              <div className="mt-3 flex min-h-[44px] flex-wrap items-center gap-2">
                <span className="text-[13px] text-[#888]">Materials markup</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  disabled={!d.materialsBillToClient}
                  className={`min-h-[44px] w-16 border px-2 text-center text-[13px] outline-none ${noSpinner} ${plexMono.className} ${bubbleRounded} disabled:opacity-45`}
                  style={{ border: `0.5px solid ${SITE.border}` }}
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
                <span>Materials (client quote)</span>
                <span className={`shrink-0 font-medium ${monoNum}`} style={{ color: SITE.green }}>
                  {formatMoney(clientMaterialsCharge)}
                </span>
              </div>
              {!d.materialsBillToClient ? (
                <p className="mt-1 text-[11px] leading-snug text-[#888]">
                  Materials are <strong>private expense</strong> — they stay under MY COSTS only and are{" "}
                  <strong>not</strong> on the quote.
                </p>
              ) : (
                <p className="mt-1 text-[11px] leading-snug text-[#888]">
                  Materials are a <strong>client expense</strong> — shown here with markup and included in quote totals.
                </p>
              )}
              {d.wasteDisposalEnabled ? (
                <div className="flex justify-between gap-2 py-1 text-neutral-800">
                  <span>Waste / disposal (pass-through)</span>
                  <span className={`shrink-0 ${monoNum}`} style={{ color: SITE.green }}>
                    {formatMoney(clientWastePass)}
                  </span>
                </div>
              ) : null}
              <div
                className={`mt-3 flex justify-between gap-2 px-3 py-4 font-bold ${bubbleRounded} overflow-hidden`}
                style={{ background: SITE.greenTint, color: SITE.green }}
              >
                <span className="text-[13px] uppercase tracking-[0.12em]">Total quote</span>
                <span className={`${plexMono.className} text-[22px] font-semibold tabular-nums`}>
                  {formatMoney(clientTotal)}
                </span>
              </div>
            </section>

            <section
              className="overflow-hidden"
              style={{
                border: `0.5px solid ${SITE.myCostsBorder}`,
                borderRadius: 8,
                background: SITE.cardBg,
              }}
            >
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 px-[14px] py-3 text-left touch-manipulation"
                onClick={() => setTotalsMyOpen((o) => !o)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-black" aria-hidden />
                <span className={`min-w-0 flex-1 ${sectionLabelCls}`}>MY COSTS — PRIVATE</span>
                <span className={`shrink-0 ${monoNum} text-neutral-900`}>{formatMoney(myCostsTotal)}</span>
                <span className="shrink-0 text-[#888]" aria-hidden>
                  {totalsMyOpen ? "▾" : "▸"}
                </span>
              </button>
              {totalsMyOpen ? (
                <div className={`border-t px-[14px] pb-[14px] pt-2`} style={{ borderColor: SITE.border }}>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-[#888]">
                    Your cost (private)
                  </p>
                  {d.workerExpenseEnabled ? (
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
                      <span>Worker expense</span>
                      <span className={`shrink-0 ${monoNum}`}>{formatMoney(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 py-1 text-neutral-800">
                    <span className="min-w-0 pr-2">
                      {d.materialsBillToClient
                        ? "Materials (your supplier cost)"
                        : "Materials (private expense · not on quote)"}
                    </span>
                    <span className={`shrink-0 ${monoNum}`}>{formatMoney(materialMyCost)}</span>
                  </div>
                  {d.wasteDisposalEnabled ? (
                    <div className="flex justify-between gap-2 py-1 text-neutral-800">
                      <span>Waste / disposal</span>
                      <span className={`shrink-0 ${monoNum}`}>{formatMoney(d.wasteDisposalAmount)}</span>
                    </div>
                  ) : null}
                  <div
                    className={`mt-2 flex justify-between gap-2 px-3 py-3 font-bold text-neutral-900 ${bubbleRounded} overflow-hidden`}
                    style={{ background: SITE.myCostsTotalBg }}
                  >
                    <span>Total my cost</span>
                    <span className={`${plexMono.className} text-[18px] font-semibold tabular-nums`}>
                      {formatMoney(myCostsTotal)}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>

            <section
              className="overflow-hidden"
              style={{
                border: `0.5px solid ${SITE.yellow}`,
                borderRadius: 8,
                background: SITE.profitBg,
              }}
            >
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 px-[14px] py-3 text-left touch-manipulation"
                onClick={() => setTotalsProfitOpen((o) => !o)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE.yellow }} aria-hidden />
                <span
                  className={`min-w-0 flex-1 font-semibold ${sectionLabelCls}`}
                  style={{ color: SITE.profitLabel }}
                >
                  MY PROFIT
                </span>
                <span className={`shrink-0 font-semibold ${monoNum}`} style={{ color: "#422006" }}>
                  {formatMoney(profit)}
                </span>
                <span className="shrink-0 text-[#888]" aria-hidden>
                  {totalsProfitOpen ? "▾" : "▸"}
                </span>
              </button>
              {totalsProfitOpen ? (
                <div className={`border-t px-[14px] pb-[14px] pt-2`} style={{ borderColor: SITE.border }}>
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
                </div>
              ) : null}
            </section>

            <button
              type="button"
              onClick={() => void pushToQuote()}
              disabled={!projectId}
              className={`min-h-[48px] w-full text-[14px] font-semibold text-white touch-manipulation disabled:opacity-45 ${bubbleRounded}`}
              style={{ background: SITE.ink }}
            >
              Push to Quote
            </button>
          </div>
        )}

        {tab === "timeline" && (
          <div className="flex min-w-0 flex-col gap-4">
            <div style={cardStyle} className={`overflow-hidden ${cardPad}`}>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[13px] font-semibold">Schedule this trade</div>
                  <div className="text-[12px] text-[#888]">Plan days on site</div>
                </div>
                <SiteSwitch
                  on={d.scheduleTradeEnabled}
                  onChange={(scheduleTradeEnabled) =>
                    update({
                      scheduleTradeEnabled,
                      ...(!scheduleTradeEnabled ? { timelineDescriptionsOnQuote: false } : {}),
                    })
                  }
                />
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
                    className={`min-h-[44px] w-full text-[13px] font-semibold text-white ${bubbleRounded} touch-manipulation`}
                    style={{ background: SITE.ink }}
                  >
                    Push to Calendar
                  </button>
                  <p className="text-[12px] leading-snug text-[#888]">
                    Day-by-day notes are not added to the estimate automatically. Use the button below when you
                    want them on the quote timeline (the estimate must have timeline/include timeline on).
                  </p>
                  <button
                    type="button"
                    disabled={!projectId}
                    onClick={() => pushTimelineToQuote()}
                    className={`min-h-[48px] w-full text-[14px] font-semibold text-white ${bubbleRounded} touch-manipulation disabled:opacity-45`}
                    style={{ background: SITE.ink }}
                  >
                    Push to quote
                  </button>
                  {d.timelineDescriptionsOnQuote ? (
                    <p className="text-center text-[12px] font-medium" style={{ color: SITE.green }}>
                      Timeline notes are set to show on the estimate
                    </p>
                  ) : null}
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
  const trackW = 52;
  const trackH = 32;
  const thumb = 26;
  const pad = 3;
  const travel = trackW - thumb - pad * 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative shrink-0 touch-manipulation rounded-full border-0 p-0 outline-none transition-colors duration-200"
      style={{
        width: trackW,
        height: trackH,
        background: on ? SITE.ink : "#cccccc",
        WebkitTapHighlightColor: "transparent",
      }}
      aria-label={on ? "On" : "Off"}
    >
      <span
        className="pointer-events-none absolute rounded-full bg-white shadow-md"
        style={{
          width: thumb,
          height: thumb,
          top: (trackH - thumb) / 2,
          left: on ? pad + travel : pad,
          transition: "left 0.2s ease-out",
        }}
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
