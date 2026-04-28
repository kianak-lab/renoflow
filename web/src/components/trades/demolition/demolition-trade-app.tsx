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
  autoLabourDays,
  contractorBags,
  dumpsterRecommendationSqFt,
  formatMoney,
  type DemoType,
} from "@/lib/demolition-calculations";
import {
  applyDemolitionToTrade,
  getDemolitionStateFromTrade,
  loadWorkspace,
  maybeSyncAutoLabourDays,
  readActiveProjectId,
  saveWorkspace,
  type CachedProductRow,
  type DemolitionV2State,
  DEMOLITION_DEFAULT_STATE,
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

const DEMO_TYPES: { id: DemoType; label: string }[] = [
  { id: "full", label: "Full Gut" },
  { id: "drywall", label: "Drywall Only" },
  { id: "flooring", label: "Flooring Only" },
  { id: "ceiling", label: "Ceiling Only" },
  { id: "selective", label: "Selective" },
];

type TabKey = "calculator" | "materials" | "labour" | "totals";

function useDebouncedPersist(fn: (next: DemolitionV2State) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (next: DemolitionV2State) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => fn(next), ms);
    },
    [fn, ms],
  );
}

function parsePrice(p: string | number | null): number {
  if (p == null) return 0;
  if (typeof p === "number") return p;
  const m = String(p).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : 0;
}

function materialSubtotalSupplier(
  products: CachedProductRow[],
  qty: Record<string, number>,
): number {
  let s = 0;
  for (const p of products) {
    const q = qty[String(p.id)] ?? 0;
    if (q <= 0) continue;
    s += parsePrice(p.price) * q;
  }
  return s;
}

export default function DemolitionTradeApp() {
  const router = useRouter();
  const sp = useSearchParams();
  const ri = Number(sp.get("ri") ?? "0");
  const ti = Number(sp.get("ti") ?? "0");
  const pidParam = sp.get("pid");

  const [tab, setTab] = useState<TabKey>("calculator");
  const [products, setProducts] = useState<CachedProductRow[]>([]);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [d, setD] = useState<DemolitionV2State>(DEMOLITION_DEFAULT_STATE);
  const dRef = useRef(d);
  dRef.current = d;

  const projectId = pidParam || readActiveProjectId() || "";

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
        const res = await fetch("/api/cached-products?trade=" + encodeURIComponent("Demolition"), {
          credentials: "include",
        });
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

  const persist = useCallback(
    (next: DemolitionV2State) => {
      if (!projectId) return;
      const ws = loadWorkspace(projectId);
      if (!ws || !ws.rooms?.[ri]?.trades?.[ti]) return;
      const room = ws.rooms[ri]!;
      const trades = room.trades!;
      const t = trades[ti]!;
      if (t.id !== "demo") return;
      applyDemolitionToTrade(t, next, products);
      saveWorkspace(projectId, ws);
    },
    [projectId, ri, ti, products],
  );

  const debouncedPersist = useDebouncedPersist(persist, 320);

  const update = useCallback(
    (patch: Partial<DemolitionV2State> | ((prev: DemolitionV2State) => DemolitionV2State)) => {
      setD((prev) => {
        const base = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        let next = { ...base };
        if (next.exteriorDumpster) {
          const sqChanged = next.sqFt !== prev.sqFt;
          const extTurnedOn = next.exteriorDumpster && !prev.exteriorDumpster;
          if (extTurnedOn || sqChanged) {
            next.dumpsterSize = dumpsterRecommendationSqFt(next.sqFt);
          }
        }
        next = maybeSyncAutoLabourDays(prev, next);
        debouncedPersist(next);
        return next;
      });
    },
    [debouncedPersist],
  );

  const autoDays = useMemo(
    () => autoLabourDays(d.sqFt, d.stairs, d.hazmat),
    [d.sqFt, d.stairs, d.hazmat],
  );

  const bags = useMemo(() => contractorBags(d.sqFt), [d.sqFt]);
  const dumpsterRec = useMemo(() => dumpsterRecommendationSqFt(d.sqFt), [d.sqFt]);
  const estLabourCost = useMemo(() => autoDays * 650, [autoDays]);

  const labourSub = useMemo(
    () => Math.max(0, d.labourDays) * Math.max(0, d.labourRate) * Math.max(1, d.workers),
    [d.labourDays, d.labourRate, d.workers],
  );

  const tradeSubPreMarkup = useMemo(() => {
    const matBase = materialSubtotalSupplier(products, d.materialQty);
    return matBase + labourSub;
  }, [products, d.materialQty, labourSub]);

  const tradeGrand = useMemo(() => {
    return tradeSubPreMarkup * (1 + d.markupPct / 100);
  }, [tradeSubPreMarkup, d.markupPct]);

  const headerDays = Math.max(1, d.labourDays || autoDays || 1);

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
    if (projectId) persist(dRef.current);
    router.push("/final");
  }

  return (
    <div
      className={`${plex.className} fixed inset-0 z-[200] flex flex-col bg-white text-neutral-900`}
      style={{ fontFamily: "var(--font-ibm-plex), system-ui, sans-serif" }}
    >
      <header
        className="shrink-0 rounded-b-none pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ background: YELLOW }}
      >
        <div className="flex items-start gap-3 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={back}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center text-2xl font-semibold text-black"
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-black">Demolition</h1>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>
              Structure
            </p>
          </div>
          <div className="shrink-0 pt-1 text-right">
            <span className="text-sm font-semibold text-black">
              {headerDays} day{headerDays === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </header>

      <div
        className="shrink-0 overflow-x-auto border-b bg-white px-3 py-2"
        style={{ borderColor: LINE }}
      >
        <div className="flex w-max min-w-full gap-2 pb-1">
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
                className="shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors"
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {!projectId ? (
          <p className="text-sm" style={{ color: MUTED }}>
            Open Demolition from a project room in RenoFlow so your work saves to the active job.
          </p>
        ) : null}

        {tab === "calculator" && (
          <div className="flex flex-col gap-6">
            <Field label="Demo type">
              <div className="flex flex-wrap gap-2">
                {DEMO_TYPES.map(({ id, label }) => {
                  const on = d.demoType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update({ demoType: id })}
                      className="min-h-[44px] px-3 text-sm font-medium"
                      style={{
                        borderRadius: 8,
                        border: `0.5px solid ${LINE}`,
                        background: on ? YELLOW : "#f3f4f6",
                        color: on ? "#000" : MUTED,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Number of rooms">
              <Stepper
                value={d.roomCount}
                min={1}
                max={99}
                onChange={(n) => update({ roomCount: n })}
              />
            </Field>

            <Field label="Total sq ft">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="min-h-[52px] w-full rounded-lg border px-4 text-lg outline-none"
                style={{ borderColor: LINE }}
                value={d.sqFt || ""}
                placeholder="0"
                onChange={(e) => update({ sqFt: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>

            <Field label="Ceiling height (ft)">
              <Stepper
                value={d.ceilingFt}
                min={6}
                max={20}
                onChange={(n) => update({ ceilingFt: n })}
              />
            </Field>

            <Field label="Hazmat present">
              <ToggleRow
                on={d.hazmat}
                onChange={(hazmat) => update({ hazmat })}
              />
              {d.hazmat ? (
                <div
                  className="mt-2 rounded-lg border px-3 py-2 text-sm font-medium text-red-800"
                  style={{ borderColor: "#fecaca", background: "#fef2f2" }}
                >
                  Hazmat detected — specialized disposal required. Add remediation cost.
                </div>
              ) : null}
            </Field>

            <Field label="Exterior dumpster needed">
              <ToggleRow
                on={d.exteriorDumpster}
                onChange={(exteriorDumpster) =>
                  update((prev) => {
                    const n = { ...prev, exteriorDumpster };
                    if (exteriorDumpster) {
                      n.dumpsterSize = dumpsterRecommendationSqFt(prev.sqFt);
                    }
                    return n;
                  })
                }
              />
              {d.exteriorDumpster ? (
                <div className="mt-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Dumpster size
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(["10", "14", "20"] as const).map((yd) => {
                      const on = d.dumpsterSize === yd;
                      return (
                        <button
                          key={yd}
                          type="button"
                          onClick={() => update({ dumpsterSize: yd })}
                          className="min-h-[44px] min-w-[4.5rem] px-3 text-sm font-semibold"
                          style={{
                            borderRadius: 8,
                            border: `0.5px solid ${LINE}`,
                            background: on ? YELLOW : "#f3f4f6",
                            color: on ? "#000" : MUTED,
                          }}
                        >
                          {yd} yd
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </Field>

            <Field label="Stairs involved">
              <ToggleRow on={d.stairs} onChange={(stairs) => update({ stairs })} />
            </Field>

            <div
              className="space-y-3 rounded-xl border px-4 py-4 text-sm"
              style={{ borderColor: LINE }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Auto-calculated
              </h2>
              <RowStat label="Contractor bags (ceil sq ft ÷ 50)" value={String(bags)} />
              <RowStat
                label="Est. labour days (sq ft ÷ 400, +1 stairs, +1 hazmat)"
                value={String(autoDays)}
              />
              <RowStat
                label="Dumpster recommendation (by sq ft)"
                value={
                  d.exteriorDumpster ? `${dumpsterRec} yd` : `${dumpsterRec} yd (if dumpster on)`
                }
              />
              <RowStat
                label="Est. labour cost @ $650/day"
                value={formatMoney(estLabourCost)}
                valueGreen
              />
            </div>
          </div>
        )}

        {tab === "materials" && (
          <div>
            {productsErr ? (
              <p className="text-sm text-red-700">{productsErr}</p>
            ) : products.length === 0 ? (
              <p className="text-sm" style={{ color: MUTED }}>
                No Demolition products in <code>cached_products</code> yet.
              </p>
            ) : (
              grouped.order.map((sub) => (
                <section key={sub} className="mb-6">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {sub}
                  </h3>
                  <ul className="divide-y" style={{ borderColor: LINE }}>
                    {grouped.map.get(sub)!.map((p) => (
                      <li key={p.id} className="flex gap-3 py-3">
                        <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-neutral-100">
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
                            <div className="text-xs font-medium text-neutral-500">{p.brand}</div>
                          ) : null}
                          <div className="font-medium leading-snug">{p.title ?? "—"}</div>
                          <div className="text-sm font-semibold" style={{ color: PRICE_GREEN }}>
                            {p.price != null ? String(p.price) : "—"}
                          </div>
                        </div>
                        <QtyStepper
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
          <div className="flex flex-col gap-6">
            <Field label="Days">
              <Stepper
                value={d.labourDays}
                min={0}
                max={365}
                onChange={(labourDays) =>
                  update({ labourDays, labourDaysTouched: true })
                }
              />
              <button
                type="button"
                className="mt-2 text-sm font-semibold underline"
                style={{ color: PRICE_GREEN }}
                onClick={() =>
                  update({
                    labourDays: autoLabourDays(d.sqFt, d.stairs, d.hazmat),
                    labourDaysTouched: false,
                  })
                }
              >
                Reset to auto ({autoDays} days)
              </button>
            </Field>
            <Field label="Day rate ($)">
              <input
                type="number"
                min={0}
                className="min-h-[52px] w-full rounded-lg border px-4 text-lg outline-none"
                style={{ borderColor: LINE }}
                value={d.labourRate}
                onChange={(e) =>
                  update({ labourRate: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </Field>
            <Field label="Workers">
              <Stepper
                value={d.workers}
                min={1}
                max={50}
                onChange={(workers) => update({ workers })}
              />
            </Field>
            <div
              className="rounded-xl border px-4 py-4 text-base font-semibold"
              style={{ borderColor: LINE, color: PRICE_GREEN }}
            >
              Labour total: {formatMoney(labourSub)}
            </div>
          </div>
        )}

        {tab === "totals" && (
          <div className="flex flex-col gap-5">
            <LineRow
              label="Material subtotal"
              value={formatMoney(materialSubtotalSupplier(products, d.materialQty))}
            />
            <LineRow label="Labour total" value={formatMoney(labourSub)} />
            <div>
              <div className="mb-2 flex justify-between text-sm font-semibold">
                <span>Markup %</span>
                <span style={{ color: PRICE_GREEN }}>{d.markupPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={d.markupPct}
                onChange={(e) => update({ markupPct: Number(e.target.value) })}
                className="h-11 w-full"
              />
            </div>
            <div className="h-px w-full" style={{ background: LINE }} />
            <LineRow label="Subtotal (materials + labour)" value={formatMoney(tradeSubPreMarkup)} />
            <LineRow label="Trade total" value={formatMoney(tradeGrand)} strong />
            <p className="text-xs" style={{ color: MUTED }}>
              Saved to your project automatically. Main quote also applies catalog line markup and
              project material markup where configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      {children}
    </div>
  );
}

function RowStat({
  label,
  value,
  valueGreen,
}: {
  label: string;
  value: string;
  valueGreen?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: LINE }}>
      <span className="text-neutral-600">{label}</span>
      <span className="font-semibold" style={{ color: valueGreen ? PRICE_GREEN : "#000" }}>
        {value}
      </span>
    </div>
  );
}

function LineRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span style={{ color: muted ? MUTED : "#000", fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span
        className="font-semibold"
        style={{ color: strong ? PRICE_GREEN : muted ? MUTED : PRICE_GREEN }}
      >
        {value}
      </span>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      className="flex h-11 max-w-[220px] items-stretch overflow-hidden rounded-lg border border-black/20"
      style={{ borderWidth: 0.5 }}
    >
      <button
        type="button"
        className="w-12 text-xl font-semibold"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <div className="flex flex-1 items-center justify-center text-lg font-semibold">{value}</div>
      <button
        type="button"
        className="w-12 text-xl font-semibold"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div
      className="flex h-9 w-[110px] shrink-0 items-stretch overflow-hidden rounded-lg"
      style={{ border: `0.5px solid ${LINE}` }}
    >
      <button type="button" className="w-9 text-lg" onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <div className="flex flex-1 items-center justify-center text-sm font-semibold">{value}</div>
      <button type="button" className="w-9 text-lg" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function ToggleRow({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex min-h-[48px] w-full max-w-xs items-center justify-between rounded-lg border px-4 text-left font-semibold"
      style={{ borderColor: LINE, background: on ? YELLOW : "#f9fafb" }}
    >
      <span>{on ? "Yes" : "No"}</span>
      <span className="text-neutral-400">{on ? "ON" : "OFF"}</span>
    </button>
  );
}
