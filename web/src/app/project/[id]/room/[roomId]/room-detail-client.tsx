"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { INTAKE_TRADE_IDS, TN } from "@/lib/final-catalog";
import { hydrateProjectWorkspaceFromApi } from "@/lib/hydrate-project-workspace";

type TradeRow = {
  id: string;
  trade_id: string;
  name: string;
  categoryLabel: string;
  note: string;
  is_open: boolean;
  days: number;
  estimated_total: number;
  status: "complete" | "in_progress" | "pending";
};

type RoomPayload = {
  project: {
    id: string;
    name: string;
    client_name: string;
    quote_number: string;
  };
  room: {
    id: string;
    name: string;
    dimensions: {
      length_ft: number;
      width_ft: number;
      height_ft: number;
      floor_sq_ft: number;
    };
    dimensions_line: string;
    estimated_total: number;
  };
  trades: TradeRow[];
  room_total: number;
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function tradeVisual(slug: string): {
  bg: string;
  fg: string;
  Icon: () => React.ReactElement;
} {
  const s = slug.trim().toLowerCase();
  if (s === "demo") {
    return {
      bg: "#fff8e1",
      fg: "#e65100",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    };
  }
  if (s === "plumbing") {
    return {
      bg: "#e3f2fd",
      fg: "#1565c0",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8 5v6a4 4 0 0 0 8 0V5M9 11v8m6-8v8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
    };
  }
  if (s === "tile") {
    return {
      bg: "#f3e5f5",
      fg: "#7b1fa2",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    };
  }
  if (s === "electrical") {
    return {
      bg: "#fff3e0",
      fg: "#f57f17",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ),
    };
  }
  if (s === "drywall") {
    return {
      bg: "#f5f5f5",
      fg: "#757575",
      Icon: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="5" y="5" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        </svg>
      ),
    };
  }
  return {
    bg: "#f5f5f5",
    fg: "#757575",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  };
}

function statusDotStyle(status: TradeRow["status"]): { dot: string; text: string; label: string } {
  if (status === "complete") return { dot: "#2d7a2d", text: "#2d7a2d", label: "Complete" };
  if (status === "in_progress") return { dot: "#f5a623", text: "#f5a623", label: "In Progress" };
  return { dot: "#aaa", text: "#aaa", label: "Pending" };
}

export default function RoomDetailClient({
  projectId,
  roomId,
}: {
  projectId: string;
  roomId: string;
}) {
  const [data, setData] = useState<RoomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [savingTrades, setSavingTrades] = useState(false);
  const [openingTradeId, setOpeningTradeId] = useState<string | null>(null);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const [mobHeaderSpacer, setMobHeaderSpacer] = useState(0);

  const router = useRouter();

  const monoStyle = { fontFamily: "var(--rf-plex-mono)" } as const;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rooms/${encodeURIComponent(roomId)}`,
        { cache: "no-store", credentials: "include" },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<RoomPayload>;
      if (!res.ok) {
        setError(j.error ?? "Could not load room.");
        setData(null);
        return;
      }
      setData(j as RoomPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!fabOpen) return;
    document.documentElement.classList.add("rf-fab-arc-open");
    return () => {
      document.documentElement.classList.remove("rf-fab-arc-open");
    };
  }, [fabOpen]);

  useEffect(() => {
    if (!addTradeOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
    };
  }, [addTradeOpen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobHeaderSpacer(mq.matches ? el.offsetHeight : 0);
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    mq.addEventListener("change", apply);
    apply();
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", apply);
    };
  }, [loading, data?.room?.name]);

  const existingSlugs = useMemo(() => new Set((data?.trades ?? []).map((t) => t.trade_id)), [data?.trades]);

  const addTradeOptions = useMemo(
    () => INTAKE_TRADE_IDS.filter((tid) => !existingSlugs.has(tid)),
    [existingSlugs],
  );

  const openAddTradeModal = useCallback(() => {
    const init: Record<string, boolean> = {};
    for (const tid of addTradeOptions) init[tid] = false;
    setPick(init);
    setAddTradeOpen(true);
  }, [addTradeOptions]);

  const saveAddedTrades = useCallback(async () => {
    if (!data) return;
    const chosen = Object.entries(pick)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!chosen.length) {
      setAddTradeOpen(false);
      return;
    }
    setSavingTrades(true);
    try {
      const tradesPayload = [
        ...data.trades.map((t) => ({
          id: t.trade_id,
          open: t.is_open,
          days: t.days,
          note: t.note ?? "",
        })),
        ...chosen.map((slug) => ({
          id: slug,
          open: false,
          days: 0,
          note: "",
        })),
      ];
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: tradesPayload }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not add trades.");
      setAddTradeOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingTrades(false);
    }
  }, [data, pick, roomId, load]);

  const deleteTrade = useCallback(
    async (t: TradeRow) => {
      if (!data) return;
      const label = TN[t.trade_id] ?? t.name;
      if (!window.confirm(`Remove "${label}" from this room? This cannot be undone.`)) return;
      setDeletingTradeId(t.id);
      setError(null);
      try {
        const tradesPayload = data.trades
          .filter((row) => row.trade_id !== t.trade_id)
          .map((row) => ({
            id: row.trade_id,
            open: row.is_open,
            days: row.days,
            note: row.note ?? "",
          }));
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trades: tradesPayload }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Could not remove trade.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Remove failed.");
      } finally {
        setDeletingTradeId(null);
      }
    },
    [data, roomId, load],
  );

  const subtitleLine = useMemo(() => {
    if (!data) return "";
    const r = data.room.name.trim();
    const c = data.project.client_name.trim();
    return [r, c].filter(Boolean).join(" · ");
  }, [data]);

  const openTradeNavigate = useCallback(
    async (t: TradeRow) => {
      setOpeningTradeId(t.id);
      setError(null);
      try {
        await hydrateProjectWorkspaceFromApi(projectId);
        if (t.trade_id === "demo") {
          const q = new URLSearchParams();
          q.set("pid", projectId);
          q.set("dbRoomId", roomId);
          router.push(`/trades/demolition?${q.toString()}`);
        } else {
          const q = new URLSearchParams();
          q.set("project", projectId);
          q.set("room", roomId);
          q.set("trade", t.trade_id);
          router.push(`/final?${q.toString()}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open trade.");
      } finally {
        setOpeningTradeId(null);
      }
    },
    [projectId, roomId, router],
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <header
        ref={headerRef}
        className="shrink-0 max-md:fixed max-md:left-0 max-md:right-0 max-md:top-0 max-md:z-[100] md:relative"
        style={{
          background: "#0f2318",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 16,
          boxSizing: "border-box",
          zIndex: 100,
          fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        <div className="flex flex-row items-start gap-3">
          <Link
            href={`/project/${encodeURIComponent(projectId)}`}
            prefetch={false}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white [-webkit-tap-highlight-color:transparent]"
            aria-label="Back to project rooms"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.4)",
                margin: "0 0 4px",
                fontWeight: 500,
              }}
            >
              {loading ? "…" : subtitleLine || "—"}
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "#fff",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Trades Sheet
            </h1>
          </div>
        </div>
      </header>

      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        style={{ marginTop: mobHeaderSpacer }}
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-none md:pb-6"
          style={{
            paddingBottom: "calc(88px + max(8px, env(safe-area-inset-bottom, 0px)))",
          }}
        >
          <div className="px-3.5 pt-3" style={{ paddingLeft: 14, paddingRight: 14 }}>
            {error ? (
              <div
                className="mb-3 rounded-[10px] p-4 text-[14px] text-[#111]"
                style={{ border: "0.5px solid #e0e0e0", background: "#f9f9f9" }}
              >
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-[13px] text-[#555]">{error}</p>
              </div>
            ) : null}

            {!loading && data ? (
              <>
                <p
                  className="mb-2 font-semibold uppercase text-[#888]"
                  style={{ fontSize: 10, letterSpacing: "0.12em" }}
                >
                  TRADES
                </p>

                {data.trades.map((t) => {
                  const vis = tradeVisual(t.trade_id);
                  const St = statusDotStyle(t.status);
                  const Icon = vis.Icon;
                  return (
                    <div
                      key={t.id}
                      className="mb-3 overflow-hidden bg-white"
                      style={{ border: "0.5px solid #e0e0e0", borderRadius: 10 }}
                    >
                      <div className="flex flex-row gap-3 p-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                          style={{ background: vis.bg, color: vis.fg, width: 40, height: 40 }}
                          aria-hidden
                        >
                          <Icon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-[#111]">{t.name}</p>
                          <p
                            className="mt-0.5 text-[11px] uppercase text-[#aaa]"
                            style={{ letterSpacing: "0.06em" }}
                          >
                            {t.categoryLabel}
                          </p>
                          <div className="mt-2 flex flex-row items-center gap-2">
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: St.dot }}
                              aria-hidden
                            />
                            <span
                              className="text-[10px] font-semibold uppercase"
                              style={{ color: St.text, letterSpacing: "0.06em" }}
                            >
                              {St.label}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[14px] font-medium text-[#111]" style={monoStyle}>
                            {fmtMoney(t.estimated_total)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#aaa]">{t.days} days</div>
                        </div>
                      </div>
                      <div
                        className="flex flex-row flex-wrap gap-2"
                        style={{
                          borderTop: "0.5px solid #f0f0f0",
                          padding: "8px 14px",
                        }}
                      >
                        <button
                          type="button"
                          disabled={openingTradeId === t.id || deletingTradeId === t.id}
                          onClick={() => void openTradeNavigate(t)}
                          className="inline-flex min-h-[36px] flex-[1.15] items-center justify-center gap-1 rounded-[100px] bg-[#0f2318] px-3 text-[11px] font-medium text-white [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
                          style={{ flex: "1.15 1 96px" }}
                        >
                          {openingTradeId === t.id ? (
                            "…"
                          ) : (
                            <>
                              Open <span aria-hidden>→</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={deletingTradeId === t.id || openingTradeId === t.id}
                          onClick={() => void deleteTrade(t)}
                          className="inline-flex min-h-[36px] flex-1 cursor-pointer items-center justify-center rounded-[100px] bg-white px-3 text-[11px] font-medium text-[#b42318] [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
                          style={{ border: "0.5px solid #f5d4d1", flex: "1 1 88px" }}
                          aria-label={`Delete ${t.name}`}
                        >
                          {deletingTradeId === t.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    if (!addTradeOptions.length) return;
                    openAddTradeModal();
                  }}
                  className="mb-6 flex min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[10px] text-[14px] font-medium text-[#555] [-webkit-tap-highlight-color:transparent] disabled:opacity-45"
                  style={{
                    border: "1px dashed #ccc",
                    background: "#fafafa",
                  }}
                  disabled={!addTradeOptions.length}
                >
                  <span className="text-lg leading-none text-[#888]" aria-hidden>
                    +
                  </span>
                  Add trade
                </button>
              </>
            ) : loading ? (
              <p className="py-10 text-center text-[13px] text-[#888]">Loading…</p>
            ) : null}
          </div>
        </div>

        <div
          role="presentation"
          className="absolute inset-0 z-[10088] md:hidden"
          style={{
            display: fabOpen ? "block" : "none",
            background: "transparent",
            backdropFilter: "blur(1px)",
            WebkitBackdropFilter: "blur(1px)",
          }}
          onClick={() => setFabOpen(false)}
          aria-hidden={!fabOpen}
        />
      </div>

      {addTradeOpen ? (
        <div
          className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/35 md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rf-add-trade-title"
          onClick={() => !savingTrades && setAddTradeOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[14px] bg-white p-4 md:rounded-[14px]"
            style={{
              maxHeight: "72vh",
              overflow: "auto",
              paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="rf-add-trade-title" className="text-[16px] font-semibold text-[#111]">
              Add trade
            </p>
            <p className="mt-1 text-[13px] text-[#666]">Select trades to add to this room.</p>
            <div className="mt-3 flex max-h-[42vh] flex-col gap-2 overflow-y-auto">
              {addTradeOptions.map((tid) => (
                <label
                  key={tid}
                  className="flex cursor-pointer flex-row items-center gap-3 rounded-[10px] border border-[#e8e8e8] px-3 py-2.5"
                  style={{ borderWidth: 0.5 }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0f2318]"
                    checked={pick[tid] ?? false}
                    onChange={(e) => setPick((p) => ({ ...p, [tid]: e.target.checked }))}
                  />
                  <span className="text-[14px] text-[#111]">{TN[tid] ?? tid}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-row gap-2">
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-[100px] border border-[#ddd] bg-white text-[13px] font-semibold text-[#555]"
                disabled={savingTrades}
                onClick={() => setAddTradeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-[100px] bg-[#0f2318] text-[13px] font-semibold text-white disabled:opacity-50"
                disabled={savingTrades}
                onClick={() => void saveAddedTrades()}
              >
                {savingTrades ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-[10100] flex md:hidden"
        style={{
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 0,
          boxSizing: "border-box",
          width: "100%",
          flexDirection: "row",
          background: "#ffffff",
          borderTop: "0.5px solid #e0e0e0",
          padding: "12px 4px max(34px, env(safe-area-inset-bottom, 34px))",
          boxShadow: "none",
          touchAction: "manipulation",
        }}
        aria-label="Bottom navigation"
      >
        <Link
          href="/final"
          prefetch={false}
          className="flex flex-1 flex-col items-center justify-center bg-transparent no-underline [-webkit-tap-highlight-color:transparent]"
          style={{
            minHeight: 44,
            minWidth: 0,
            gap: 3,
            padding: "0 2px 8px",
            margin: 0,
            border: "none",
            color: "#aaa",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <span className="flex h-[28px] w-[28px] items-center justify-center text-current" aria-hidden>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z" />
            </svg>
          </span>
          <span
            className="max-w-full truncate uppercase"
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.05em",
              lineHeight: 1.15,
            }}
          >
            Home
          </span>
        </Link>

        <div
          className="flex flex-1 flex-col items-center justify-center text-[#0f2318]"
          style={{
            minHeight: 44,
            minWidth: 0,
            gap: 3,
            padding: "0 2px 8px",
            margin: 0,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <span className="flex h-[28px] w-[28px] items-center justify-center text-current" aria-hidden>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.25" />
              <rect x="14" y="3" width="7" height="7" rx="1.25" />
              <rect x="3" y="14" width="7" height="7" rx="1.25" />
              <rect x="14" y="14" width="7" height="7" rx="1.25" />
            </svg>
          </span>
          <span
            className="max-w-full truncate uppercase text-[#0f2318]"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.05em",
              lineHeight: 1.15,
            }}
          >
            Projects
          </span>
        </div>

        <div
          className="relative z-[12] flex min-w-0 flex-1 flex-col items-center justify-center"
          style={{ paddingBottom: 2, marginTop: -28 }}
        >
          <div
            className="absolute bottom-full left-1/2 z-10 -translate-x-1/2"
            style={{
              width: 280,
              height: 260,
              pointerEvents: fabOpen ? "auto" : "none",
            }}
          >
            <button
              type="button"
              className="absolute flex flex-col items-center gap-1.5 border-0 bg-transparent p-0"
              style={{
                left: "50%",
                bottom: 115,
                marginLeft: -115,
                pointerEvents: fabOpen ? "auto" : "none",
                opacity: fabOpen ? 1 : 0,
                transform: fabOpen ? "scale(1) translateY(0)" : "scale(0.5) translateY(20px)",
                transition: "opacity .35s cubic-bezier(.34,1.56,.64,1), transform .35s cubic-bezier(.34,1.56,.64,1)",
                transitionDelay: fabOpen ? "0.05s" : "0s",
              }}
              onClick={() => {
                setFabOpen(false);
                window.location.href = "/final";
              }}
              aria-label="New Job"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0f2318] text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-7H9v7H5a1 1 0 0 1-1-1v-9.5z"
                    stroke="#fff"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <line x1="17.5" y1="6.5" x2="21.5" y2="10.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
                  <line x1="21.5" y1="6.5" x2="17.5" y2="10.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              <span
                className="rounded-[100px] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#555]"
                style={{ border: "0.5px solid #e0e0e0" }}
              >
                New Job
              </span>
            </button>
            <button
              type="button"
              className="absolute flex flex-col items-center gap-1.5 border-0 bg-transparent p-0"
              style={{
                left: "50%",
                bottom: 152,
                marginLeft: -28,
                pointerEvents: fabOpen ? "auto" : "none",
                opacity: fabOpen ? 1 : 0,
                transform: fabOpen ? "scale(1) translateY(0)" : "scale(0.5) translateY(20px)",
                transition: "opacity .35s cubic-bezier(.34,1.56,.64,1), transform .35s cubic-bezier(.34,1.56,.64,1)",
                transitionDelay: fabOpen ? "0.1s" : "0s",
              }}
              onClick={() => {
                setFabOpen(false);
                window.location.href = "/final";
              }}
              aria-label="Quick Quote"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0f2318] text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M7 3h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
                    stroke="#fff"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <line x1="9" y1="12" x2="15" y2="12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="9" y1="16" x2="14" y2="16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span
                className="rounded-[100px] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#555]"
                style={{ border: "0.5px solid #e0e0e0" }}
              >
                Quick Quote
              </span>
            </button>
            <button
              type="button"
              className="absolute flex flex-col items-center gap-1.5 border-0 bg-transparent p-0"
              style={{
                left: "50%",
                bottom: 115,
                marginLeft: 58,
                pointerEvents: fabOpen ? "auto" : "none",
                opacity: fabOpen ? 1 : 0,
                transform: fabOpen ? "scale(1) translateY(0)" : "scale(0.5) translateY(20px)",
                transition: "opacity .35s cubic-bezier(.34,1.56,.64,1), transform .35s cubic-bezier(.34,1.56,.64,1)",
                transitionDelay: fabOpen ? "0.15s" : "0s",
              }}
              onClick={() => {
                setFabOpen(false);
                window.location.href = "/final";
              }}
              aria-label="New Client"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0f2318] text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="10" cy="8" r="3.25" stroke="#fff" strokeWidth="1.75" />
                  <path
                    d="M4 20.5v-.5a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v.5"
                    stroke="#fff"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                  <line x1="17.5" y1="6.5" x2="21.5" y2="10.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
                  <line x1="21.5" y1="6.5" x2="17.5" y2="10.5" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              <span
                className="rounded-[100px] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#555]"
                style={{ border: "0.5px solid #e0e0e0" }}
              >
                New Client
              </span>
            </button>
          </div>

          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded-full bg-[#0f2318] text-white [-webkit-tap-highlight-color:transparent]"
            style={{
              width: 56,
              height: 56,
              border: "3px solid #fff",
              boxShadow: "0 4px 16px rgba(15,35,24,0.35)",
              padding: 0,
              cursor: "pointer",
              transform: fabOpen ? "rotate(45deg)" : undefined,
              transition: "transform 0.2s ease",
            }}
            aria-expanded={fabOpen}
            aria-haspopup="true"
            aria-label="New job"
            onClick={() => setFabOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
          <span
            className="text-center uppercase text-[#0f2318]"
            style={{
              marginTop: 6,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.05em",
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              maxWidth: 72,
              lineHeight: 1.15,
            }}
            aria-hidden
          >
            New Job
          </span>
        </div>

        <Link
          href="/final"
          prefetch={false}
          className="flex flex-1 flex-col items-center justify-center bg-transparent no-underline [-webkit-tap-highlight-color:transparent]"
          style={{
            minHeight: 44,
            minWidth: 0,
            gap: 3,
            padding: "0 2px 8px",
            margin: 0,
            border: "none",
            color: "#aaa",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <span className="flex h-[28px] w-[28px] items-center justify-center text-current" aria-hidden>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h7l5 5v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="12" y2="17" />
            </svg>
          </span>
          <span
            className="max-w-full truncate uppercase"
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.05em",
              lineHeight: 1.15,
            }}
          >
            Quote
          </span>
        </Link>

        <Link
          href="/final"
          prefetch={false}
          className="flex flex-1 flex-col items-center justify-center bg-transparent no-underline [-webkit-tap-highlight-color:transparent]"
          style={{
            minHeight: 44,
            minWidth: 0,
            gap: 3,
            padding: "0 2px 8px",
            margin: 0,
            border: "none",
            color: "#aaa",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <span className="flex h-[28px] w-[28px] items-center justify-center text-current" aria-hidden>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <span
            className="max-w-full truncate uppercase"
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.05em",
              lineHeight: 1.15,
            }}
          >
            Clients
          </span>
        </Link>
      </nav>
    </div>
  );
}
