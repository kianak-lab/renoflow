"use client";

import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { parsePrice } from "@/lib/demolition-calculations";
import { useProfile } from "@/hooks/useProfile";
import {
  type CachedProductRow,
  getDemolitionStateFromTrade,
  loadWorkspace,
  readActiveProjectId,
  type DemolitionV3State,
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

const SITE = {
  yellow: "#FFE000",
  ink: "#111111",
  muted: "#888888",
  subtleBg: "#f0f0f0",
  white: "#ffffff",
  cardBg: "#f9f9f9",
  border: "#e0e0e0",
  green: "#2d7a2d",
} as const;

const sectionLabelCls =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888]";

/** Mirrors final.html `catalogLineClientTotal` for demolition markup + project materials %. */
function lineQuoteEstimate(
  sup: number,
  qty: number,
  demoMarkupPct: number,
  globalMatPct: number,
): number {
  const gmk = Math.max(0, globalMatPct) / 100;
  const m = Math.max(0, demoMarkupPct);
  const line = Math.max(0, sup) * Math.max(0, qty) * (1 + m / 100);
  return Math.round(line * (1 + gmk) * 100) / 100;
}

export type DemolitionMaterialsListAppProps = {
  initialPid?: string;
  initialDbRoomId?: string;
  initialRi?: string;
  initialTi?: string;
};

export default function DemolitionMaterialsListApp(props: DemolitionMaterialsListAppProps = {}) {
  const { formatMoney } = useProfile();
  const {
    initialPid = "",
    initialDbRoomId = "",
    initialRi = "",
    initialTi = "",
  } = props;
  const router = useRouter();
  const sp = useSearchParams();
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

  const riParam = Number(sp.get("ri") ?? initialRi ?? "0");
  const tiParam = Number(sp.get("ti") ?? initialTi ?? "0");

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

  const roomName = useMemo(() => {
    if (!projectId) return "Room";
    const ws = loadWorkspace(projectId);
    return ws?.rooms?.[ri]?.n ?? "Room";
  }, [projectId, ri]);

  const [products, setProducts] = useState<CachedProductRow[]>([]);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [d, setD] = useState<DemolitionV3State | null>(null);

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

  useEffect(() => {
    if (!projectId) {
      setD(null);
      return;
    }
    const ws = loadWorkspace(projectId);
    const t = ws?.rooms?.[ri]?.trades?.[ti];
    if (!t || (t as { id?: string }).id !== "demo") {
      setD(null);
      return;
    }
    setD(getDemolitionStateFromTrade(t as Parameters<typeof getDemolitionStateFromTrade>[0]));
  }, [projectId, ri, ti]);

  const globalMatPct = useMemo(() => {
    if (!projectId) return 0;
    const ws = loadWorkspace(projectId);
    const m = ws?.mk?.mat;
    return typeof m === "number" && !Number.isNaN(m) ? Math.max(0, m) : 0;
  }, [projectId]);

  const catPickThumbs = useMemo(() => {
    if (!projectId) return {} as Record<string, string>;
    const ws = loadWorkspace(projectId);
    const tr = ws?.rooms?.[ri]?.trades?.[ti] as
      | { catPick?: Record<string, { thumb?: string }> }
      | undefined;
    const out: Record<string, string> = {};
    const cp = tr?.catPick;
    if (!cp || typeof cp !== "object") return out;
    for (const [pid, row] of Object.entries(cp)) {
      const th = row?.thumb;
      if (typeof th === "string" && th.trim()) out[pid] = th.trim();
    }
    return out;
  }, [projectId, ri, ti]);

  const rows = useMemo(() => {
    if (!d) return [];
    const out: Array<{
      id: string;
      title: string;
      brand: string;
      subsection: string;
      unitPrice: number;
      qty: number;
      supplierExt: number;
      quoteLine: number;
      thumbUrl: string | null;
    }> = [];
    for (const p of products) {
      const id = String(p.id);
      const qty = Math.max(0, d.materialQty[id] ?? 0);
      if (qty <= 0) continue;
      const unitPrice =
        typeof p.price === "number"
          ? p.price
          : parsePrice(String(p.price ?? ""));
      const supplierExt = Math.round(unitPrice * qty * 100) / 100;
      const quoteLine = d.materialsBillToClient
        ? lineQuoteEstimate(unitPrice, qty, d.clientMaterialsMarkupPct, globalMatPct)
        : 0;
      const subsection =
        p.subsection && String(p.subsection).trim()
          ? String(p.subsection).trim()
          : "(Uncategorized)";
      const thumbRaw = p.thumbnail ?? catPickThumbs[id] ?? null;
      const thumbUrl =
        typeof thumbRaw === "string" && thumbRaw.trim() ? thumbRaw.trim() : null;
      out.push({
        id,
        title: p.title ?? "—",
        brand: p.brand ?? "",
        subsection,
        unitPrice,
        qty,
        supplierExt,
        quoteLine,
        thumbUrl,
      });
    }
    out.sort((a, b) =>
      a.subsection === b.subsection
        ? a.title.localeCompare(b.title)
        : a.subsection.localeCompare(b.subsection),
    );
    return out;
  }, [products, d, globalMatPct, catPickThumbs]);

  const supplierGrand = useMemo(
    () => Math.round(rows.reduce((s, r) => s + r.supplierExt, 0) * 100) / 100,
    [rows],
  );

  const quoteGrand = useMemo(() => {
    if (!d?.materialsBillToClient) return 0;
    return Math.round(rows.reduce((s, r) => s + r.quoteLine, 0) * 100) / 100;
  }, [rows, d?.materialsBillToClient]);

  const demolitionMkOnlyGrand = useMemo(() => {
    if (!d?.materialsBillToClient) return 0;
    const mk = 1 + Math.max(0, d.clientMaterialsMarkupPct) / 100;
    return Math.round(supplierGrand * mk * 100) / 100;
  }, [supplierGrand, d?.materialsBillToClient, d?.clientMaterialsMarkupPct]);

  function backToDemolition() {
    if (!projectId) {
      router.push("/trades/demolition");
      return;
    }
    const qs = new URLSearchParams();
    qs.set("pid", projectId);
    if (dbRoomIdParam) qs.set("dbRoomId", dbRoomIdParam);
    qs.set("ri", String(ri));
    qs.set("ti", String(ti));
    router.push(`/trades/demolition?${qs.toString()}`);
  }

  const cardPad = "px-[14px] py-[14px]";
  const monoNum = `${plexMono.className} text-[14px] font-medium tabular-nums`;
  const cardStyle = {
    background: SITE.cardBg,
    border: `0.5px solid ${SITE.border}`,
    borderRadius: 8,
  } as const;

  return (
    <div
      className={`${plexSans.className} fixed inset-0 z-[500] flex max-w-[100vw] flex-col overflow-x-hidden bg-white text-[13px] text-neutral-900 antialiased`}
      style={{ minHeight: "100dvh", fontSize: 13 }}
    >
      <header className="shrink-0 rounded-none" style={{ background: SITE.yellow }}>
        <div className="flex items-start gap-2 px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => backToDemolition()}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-2xl font-semibold"
            style={{ color: SITE.ink }}
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-medium leading-tight" style={{ color: SITE.ink }}>
              Demolition materials list
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[#888]">
              {roomName.trim() || "Room"} · quantities &gt; 0
            </p>
          </div>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        style={{ background: SITE.white }}
      >
        {!projectId ? (
          <p className="text-[13px] text-[#888]">
            Open this list from Demolition with an active project so materials load.
          </p>
        ) : null}

        {projectId && !d ? (
          <p className="text-[13px] text-[#888]">Could not load demolition materials for this room.</p>
        ) : null}

        {productsErr ? <p className="text-[13px] text-red-700">{productsErr}</p> : null}

        {d && !productsErr && rows.length === 0 ? (
          <p className="text-[13px] text-[#888]">
            No materials with quantity yet. Add quantities on the Demolition Materials tab.
          </p>
        ) : null}

        {d && rows.length > 0 ? (
          <div className="space-y-6">
            <div style={cardStyle} className={cardPad}>
              <div className={sectionLabelCls}>Billing</div>
              <p className="mt-1 text-[13px] text-neutral-800">
                {d.materialsBillToClient ? (
                  <>
                    <strong className="text-neutral-900">Client invoice</strong> — a{" "}
                    <strong>client expense</strong>: amounts appear on the quote (demolition markup{" "}
                    {d.clientMaterialsMarkupPct}%
                    {globalMatPct > 0 ? ` · project materials ${globalMatPct}%` : ""}).
                  </>
                ) : (
                  <>
                    <strong className="text-neutral-900">Private expense</strong> — only your supplier totals below;{" "}
                    <strong>not</strong> on the client quote.
                  </>
                )}
              </p>
            </div>

            {rows.map((r) => (
              <article key={r.id} style={cardStyle} className={`${cardPad} flex gap-3`}>
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden bg-neutral-100"
                  style={{ borderRadius: 8 }}
                >
                  {r.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={sectionLabelCls}>{r.subsection}</div>
                  {r.brand ? <div className="mt-0.5 text-[11px] text-[#888]">{r.brand}</div> : null}
                  <h2 className="mt-1 text-[14px] font-semibold leading-snug text-neutral-900">{r.title}</h2>
                  <dl className={`mt-3 grid gap-2 text-[13px] ${monoNum}`}>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#888]">Unit</dt>
                      <dd>{formatMoney(r.unitPrice)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#888]">Qty</dt>
                      <dd>{r.qty}</dd>
                    </div>
                    <div className="flex justify-between gap-2 font-semibold text-neutral-900">
                      <dt className="font-normal text-[#888]">Supplier total</dt>
                      <dd style={{ color: SITE.green }}>{formatMoney(r.supplierExt)}</dd>
                    </div>
                    {d.materialsBillToClient ? (
                      <div
                        className="flex justify-between gap-2 border-t pt-2 font-semibold text-neutral-900"
                        style={{ borderColor: SITE.border }}
                      >
                        <dt className="font-normal text-[#888]">On quote (est.)</dt>
                        <dd style={{ color: SITE.green }}>{formatMoney(r.quoteLine)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </article>
            ))}

            <section
              className={cardPad}
              style={{
                ...cardStyle,
                border: `0.5px solid ${SITE.green}`,
                background: SITE.white,
              }}
            >
              <div className={`mb-3 font-semibold ${sectionLabelCls}`} style={{ color: SITE.green }}>
                Totals
              </div>
              <div className={`flex justify-between gap-2 text-[14px] ${monoNum}`}>
                <span className="text-neutral-800">Supplier subtotal</span>
                <span className="font-semibold" style={{ color: SITE.green }}>
                  {formatMoney(supplierGrand)}
                </span>
              </div>
              {d.materialsBillToClient ? (
                <>
                  <div className={`mt-2 flex justify-between gap-2 text-[13px] ${monoNum}`}>
                    <span className="text-neutral-800">
                      {globalMatPct > 0
                        ? `After demolition markup (${d.clientMaterialsMarkupPct}%)`
                        : "Quote estimate"}
                    </span>
                    <span className="font-semibold" style={{ color: SITE.green }}>
                      {formatMoney(demolitionMkOnlyGrand)}
                    </span>
                  </div>
                  {globalMatPct > 0 ? (
                    <div className={`mt-1 flex justify-between gap-2 text-[14px] ${monoNum}`}>
                      <span className="text-neutral-800">Est. on PDF quote</span>
                      <span className="font-semibold" style={{ color: SITE.green }}>
                        {formatMoney(quoteGrand)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
