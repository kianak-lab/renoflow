"use client";

import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type HubTradeChip = { trade_id: string; label: string };

type HubRoom = {
  id: string;
  name: string;
  icon: string;
  dimensions?: Record<string, unknown>;
  dimensionsLabel: string;
  estimatedTotal: number;
  trades: HubTradeChip[];
};

type HubPayload = {
  project: {
    id: string;
    name: string;
    client_name: string;
    address: string;
    quote_number: string;
    start_date: string;
  };
  stats: {
    projectValue: number;
    outstanding: number;
    roomsCount: number;
    daysActive: number;
  };
  rooms: HubRoom[];
};

function hubFinalHref(projectId: string, query?: Record<string, string>): string {
  const sp = new URLSearchParams();
  sp.set("project", projectId);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
  }
  return `/final?${sp.toString()}`;
}

function roomCoverPhoto(dims: Record<string, unknown> | undefined): string | null {
  const v = dims?.cover_photo;
  return typeof v === "string" && v.startsWith("data:image") ? v : null;
}

async function compressImageFileToJpegDataUrl(file: File, maxSide = 720, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}

export default function ProjectHubClient({ projectId }: { projectId: string }) {
  const { formatMoney } = useProfile();
  const [data, setData] = useState<HubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [uploadingPhotoRoomId, setUploadingPhotoRoomId] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const [mobHeaderSpacer, setMobHeaderSpacer] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/hub`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<HubPayload>;
      if (!res.ok) {
        setError(j.error ?? "Could not load project.");
        setData(null);
        return;
      }
      setData(j as HubPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const deleteRoom = useCallback(
    async (roomId: string, roomName: string) => {
      const ok = window.confirm(
        `Delete "${roomName}"? Materials and trades for this room will be removed. This cannot be undone.`,
      );
      if (!ok) return;
      setDeletingRoomId(roomId);
      setError(null);
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(j.error ?? "Could not delete room.");
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setDeletingRoomId(null);
      }
    },
    [load],
  );

  const uploadRoomPhoto = useCallback(
    async (roomId: string, fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file || !data) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      setUploadingPhotoRoomId(roomId);
      setError(null);
      try {
        const dataUrl = await compressImageFileToJpegDataUrl(file);
        if (dataUrl.length > 4_500_000) {
          setError("That image is too large after compressing. Try a smaller photo.");
          return;
        }
        const room = data.rooms.find((r) => r.id === roomId);
        const prevDims =
          room?.dimensions && typeof room.dimensions === "object"
            ? { ...(room.dimensions as Record<string, unknown>) }
            : {};
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dimensions: { ...prevDims, cover_photo: dataUrl },
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(j.error ?? "Could not save photo.");
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not process image.");
      } finally {
        setUploadingPhotoRoomId(null);
      }
    },
    [data, load],
  );

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
  }, [loading, data?.project?.name]);

  const monoStyle = { fontFamily: "var(--rf-plex-mono)" } as const;

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
            href="/projects"
            prefetch={false}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white [-webkit-tap-highlight-color:transparent]"
            aria-label="Back to projects"
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
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
                margin: "0 0 4px",
                fontWeight: 500,
              }}
            >
              Project Rooms
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
              {loading ? "…" : data?.project.name ?? "Project"}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                margin: "6px 0 0",
                lineHeight: 1.35,
              }}
            >
              {loading
                ? "…"
                : [data?.project.client_name?.trim(), data?.project.address?.trim()]
                    .filter(Boolean)
                    .join(" · ") || "—"}
            </p>
            {!loading && data ? (
              <div
                className="mt-3 flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <Link
                  href={hubFinalHref(projectId, { pg: "quote" })}
                  prefetch={false}
                  className="inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-[100px] bg-white px-2.5 text-[11px] font-semibold leading-tight text-[#0f2318] no-underline [-webkit-tap-highlight-color:transparent]"
                >
                  View Quote
                </Link>
                <Link
                  href={`/project/${encodeURIComponent(projectId)}/schedule`}
                  prefetch={false}
                  className="inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-[100px] px-2.5 text-[11px] font-semibold leading-tight text-white no-underline [-webkit-tap-highlight-color:transparent]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "0.5px solid rgba(255,255,255,0.35)",
                  }}
                >
                  Timeline
                </Link>
                <Link
                  href={hubFinalHref(projectId, { pg: "inv" })}
                  prefetch={false}
                  className="inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-[100px] px-2.5 text-[11px] font-semibold leading-tight text-white no-underline [-webkit-tap-highlight-color:transparent]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "0.5px solid rgba(255,255,255,0.35)",
                  }}
                >
                  Invoice
                </Link>
                <Link
                  href={hubFinalHref(projectId, { pg: "shop" })}
                  prefetch={false}
                  className="inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-[100px] px-2.5 text-[11px] font-semibold leading-tight text-white no-underline [-webkit-tap-highlight-color:transparent]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "0.5px solid rgba(255,255,255,0.35)",
                  }}
                >
                  All Materials
                </Link>
              </div>
            ) : null}
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
                <div
                  className="mb-4"
                  style={{
                    border: "0.5px solid #e0e0e0",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-[#888]">Project value</span>
                    <span className="font-medium text-[#2d7a2d]" style={monoStyle}>
                      {formatMoney(data.stats.projectValue)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-[13px]">
                    <span className="text-[#888]">Outstanding</span>
                    <span className="font-medium text-[#c0392b]" style={monoStyle}>
                      {formatMoney(data.stats.outstanding)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-[13px]">
                    <span className="text-[#888]">Rooms</span>
                    <span className="font-medium text-[#111]" style={monoStyle}>
                      {data.stats.roomsCount}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-[13px]">
                    <span className="text-[#888]">Days active</span>
                    <span className="font-medium text-[#111]" style={monoStyle}>
                      {data.stats.daysActive}
                    </span>
                  </div>
                </div>

                <p
                  className="mb-2 font-semibold uppercase text-[#888]"
                  style={{ fontSize: 10, letterSpacing: "0.12em" }}
                >
                  ROOMS
                </p>

                {data.rooms.map((room) => {
                  const coverPhoto = roomCoverPhoto(room.dimensions);
                  const inputId = `room-cover-${room.id}`;
                  return (
                  <div
                    key={room.id}
                    className="mb-3 overflow-hidden bg-white"
                    style={{
                      border: "0.5px solid #e0e0e0",
                      borderRadius: 10,
                    }}
                  >
                    <div className="flex flex-row gap-3 p-3">
                      <div className="relative shrink-0">
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden
                          disabled={uploadingPhotoRoomId === room.id}
                          onChange={(e) => {
                            void uploadRoomPhoto(room.id, e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
                          style={{
                            background: "#1a3d28",
                            width: 132,
                            height: 132,
                          }}
                          aria-label={`Choose photo for ${room.name}`}
                          disabled={uploadingPhotoRoomId === room.id}
                          onClick={() => document.getElementById(inputId)?.click()}
                        >
                          {uploadingPhotoRoomId === room.id ? (
                            <span className="text-[48px] leading-none text-white" aria-hidden>
                              …
                            </span>
                          ) : coverPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element -- user-selected data URL from device gallery
                            <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <svg width="66" height="66" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-7h-6v7H5a1 1 0 0 1-1-1v-9.5z"
                                stroke="#fff"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[#111]">{room.name}</p>
                        <p className="mt-0.5 text-[12px] text-[#888]" style={monoStyle}>
                          {room.dimensionsLabel}
                        </p>
                        {room.trades.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {room.trades.map((t) => (
                              <span
                                key={`${room.id}-${t.trade_id}`}
                                className="inline-block rounded-[100px] px-2 py-1 text-[10px] font-semibold uppercase text-[#555]"
                                style={{
                                  background: "#f5f5f5",
                                  border: "0.5px solid #e0e0e0",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {t.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-[13px] font-medium text-[#111]" style={monoStyle}>
                        {formatMoney(room.estimatedTotal)}
                      </div>
                    </div>
                    <div
                      className="flex flex-row flex-wrap gap-2"
                      style={{
                        borderTop: "0.5px solid #f0f0f0",
                        padding: "8px 12px",
                      }}
                    >
                      <Link
                        href={hubFinalHref(projectId, { pg: "shop", room: room.id })}
                        prefetch={false}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-[100px] bg-white px-3 text-[11px] font-medium text-[#555] no-underline [-webkit-tap-highlight-color:transparent]"
                        style={{ border: "0.5px solid #e0e0e0", flex: "1 1 90px" }}
                      >
                        Room Materials
                      </Link>
                      <button
                        type="button"
                        disabled={deletingRoomId === room.id}
                        onClick={() => void deleteRoom(room.id, room.name)}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-[100px] bg-white px-3 text-[11px] font-medium text-[#c0392b] [-webkit-tap-highlight-color:transparent] disabled:opacity-50"
                        style={{ border: "0.5px solid #e0e0e0", flex: "1 1 90px" }}
                      >
                        {deletingRoomId === room.id ? "…" : "Delete"}
                      </button>
                      <Link
                        href={`/project/${encodeURIComponent(projectId)}/room/${encodeURIComponent(room.id)}`}
                        prefetch={false}
                        className="inline-flex min-h-[40px] flex-[1.1] items-center justify-center gap-1 rounded-[100px] bg-[#0f2318] px-3 text-[11px] font-medium text-white no-underline [-webkit-tap-highlight-color:transparent]"
                        style={{ flex: "1.1 1 100px" }}
                      >
                        Open <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </div>
                  );
                })}

                <Link
                  href={hubFinalHref(projectId, { openAddRoom: "1" })}
                  prefetch={false}
                  className="mb-6 flex min-h-[52px] flex-row items-center justify-center gap-2 rounded-[10px] text-[14px] font-medium text-[#555] no-underline [-webkit-tap-highlight-color:transparent]"
                  style={{
                    border: "1px dashed #ccc",
                    background: "#fafafa",
                  }}
                >
                  <span className="text-lg leading-none text-[#888]" aria-hidden>
                    +
                  </span>
                  Add room
                </Link>
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
