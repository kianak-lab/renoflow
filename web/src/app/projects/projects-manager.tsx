"use client";

import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

type ClientRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  address: string | null;
  quote_number: string | null;
  notes: string | null;
  updated_at: string;
  start_date?: string | null;
  deadline_date?: string | null;
  invoice_count?: number;
  client: ClientRow | null;
};

type FilterPill = "all" | "active" | "quoted" | "invoiced" | "completed";
type WorkflowCat = "draft" | "active" | "quoted" | "invoiced" | "completed";

const THUMB_BG = ["#0f2318", "#1a3d28", "#2a4a3a"] as const;

function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

function isCompletedByDeadline(p: ProjectRow): boolean {
  if (!p.deadline_date) return false;
  const dl = parseLocalYmd(p.deadline_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  dl.setHours(0, 0, 0, 0);
  return dl < now;
}

function workflowBucket(p: ProjectRow): WorkflowCat {
  if (isCompletedByDeadline(p)) return "completed";
  const inv = p.invoice_count ?? 0;
  if (inv > 0) return "invoiced";
  const hasClient = Boolean(p.client_id || (p.client_name && p.client_name.trim()));
  if (!hasClient) return "draft";
  if (!p.start_date) return "quoted";
  return "active";
}

function clientDisplayName(p: ProjectRow): string {
  if (p.client?.full_name?.trim()) return p.client.full_name.trim();
  const n = (p.client_name ?? "").trim();
  if (n) return n;
  return "Client";
}

function clientSummary(p: ProjectRow): string {
  if (p.client) {
    const bits = [p.client.full_name];
    if (p.client.email) bits.push(p.client.email);
    else if (p.client.phone) bits.push(p.client.phone);
    return bits.join(" · ");
  }
  const name = (p.client_name ?? "").trim();
  if (!name) return "—";
  if (p.client_id) return name;
  return `${name} (not linked)`;
}

function daysLabel(p: ProjectRow): string {
  if (p.deadline_date) {
    const dl = parseLocalYmd(p.deadline_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dl.setHours(0, 0, 0, 0);
    const diff = Math.round((dl.getTime() - now.getTime()) / 86400000);
    if (diff > 0) return `${diff}d`;
    if (diff === 0) return "Due";
  }
  const upd = new Date(p.updated_at);
  const ago = Math.max(0, Math.floor((Date.now() - upd.getTime()) / 86400000));
  return `${ago}d`;
}

function statusPresentation(cat: WorkflowCat): { dot: string; label: string; color: string } {
  switch (cat) {
    case "draft":
      return { dot: "#aaa", label: "DRAFT", color: "#aaa" };
    case "quoted":
      return { dot: "#f5a623", label: "QUOTED", color: "#f5a623" };
    case "active":
      return { dot: "#2d7a2d", label: "ACTIVE", color: "#2d7a2d" };
    case "invoiced":
      return { dot: "#2d7a2d", label: "INVOICED", color: "#2d7a2d" };
    case "completed":
      return { dot: "#aaa", label: "COMPLETED", color: "#aaa" };
    default:
      return { dot: "#aaa", label: "", color: "#aaa" };
  }
}

const FILTER_ORDER: { key: FilterPill; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "quoted", label: "Quoted" },
  { key: "invoiced", label: "Invoiced" },
  { key: "completed", label: "Completed" },
];

function matchesFilter(p: ProjectRow, filter: FilterPill): boolean {
  if (filter === "all") return true;
  const w = workflowBucket(p);
  if (filter === "active") return w === "active";
  if (filter === "quoted") return w === "quoted";
  if (filter === "invoiced") return w === "invoiced";
  if (filter === "completed") return w === "completed";
  return true;
}

export default function ProjectsManager() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [fabOpen, setFabOpen] = useState(false);

  const [fName, setFName] = useState("");
  const [fClientId, setFClientId] = useState("");
  const [fClientName, setFClientName] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fQuote, setFQuote] = useState("");
  const [fNotes, setFNotes] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [pr, cl] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/clients", { cache: "no-store" }),
      ]);
      const pj = (await pr.json().catch(() => ({}))) as {
        projects?: ProjectRow[];
        error?: string;
      };
      const cj = (await cl.json().catch(() => ({}))) as {
        clients?: ClientRow[];
        error?: string;
      };
      if (!pr.ok) {
        setError(pj.error ?? "Could not load projects.");
        setProjects([]);
      } else {
        setProjects(pj.projects ?? []);
      }
      if (!cl.ok) {
        setError((e) => e ?? cj.error ?? "Could not load clients.");
        setClients([]);
      } else {
        setClients(cj.clients ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (!matchesFilter(p, filter)) return false;
      if (!q) return true;
      const blob = [p.name, clientSummary(p), p.address ?? ""].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [projects, search, filter]);

  function openEdit(p: ProjectRow) {
    setEditing(p);
    setFormError(null);
    setFName(p.name ?? "");
    setFClientId(p.client_id ?? "");
    setFClientName(p.client_name ?? "");
    setFAddress(p.address ?? "");
    setFQuote(p.quote_number ?? "");
    setFNotes(p.notes ?? "");
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setFormError(null);
  }

  async function deleteProject(p: ProjectRow) {
    setDeletingId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete project.");
        return;
      }
      if (editing?.id === p.id) setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: fName.trim(),
        address: fAddress.trim() || null,
        quote_number: fQuote.trim() || null,
        notes: fNotes.trim() || null,
      };
      const sel = fClientId.trim();
      if (sel === "") {
        body.client_id = null;
        body.client_name = fClientName.trim() || null;
      } else {
        body.client_id = sel;
      }

      const res = await fetch(`/api/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        project?: ProjectRow & { client: ClientRow | null };
        error?: string;
      };
      if (!res.ok) {
        setFormError(data.error ?? "Save failed.");
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!fabOpen) return;
    document.documentElement.classList.add("rf-fab-arc-open");
    return () => {
      document.documentElement.classList.remove("rf-fab-arc-open");
    };
  }, [fabOpen]);

  /** Lock document scroll on this screen so iOS rubber-band does not move the shell / tab bar. */
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

  return (
    <div
      className="flex max-h-[100svh] min-h-0 flex-col overflow-hidden [height:100svh]"
      style={{ fontFamily: "inherit" }}
    >
      <header
        className="shrink-0 text-white"
        style={{
          background: "#0f2318",
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="px-3.5 pb-3 pt-0.5" style={{ paddingLeft: 14, paddingRight: 14 }}>
          <h1 className="text-[22px] font-medium leading-tight tracking-tight text-white">
            Projects
          </h1>
        </div>

        <div className="px-3.5 pb-4" style={{ paddingLeft: 14, paddingRight: 14 }}>
          <label className="relative block">
            <span
              className="pointer-events-none absolute bottom-0 left-3 top-0 flex w-[18px] items-center justify-start text-white/50"
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, clients..."
              className="w-full rounded-[10px] pr-3.5 text-[15px] text-white outline-none placeholder:text-white/40"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "0.5px solid rgba(255,255,255,0.15)",
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 12 + 18 + 10,
                paddingRight: 14,
                minHeight: 44,
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>
      </header>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-none pb-4 md:pb-6">
        <div
          className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ padding: "12px 14px", gap: 6 }}
        >
          {FILTER_ORDER.map(({ key, label }) => {
            const on = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="shrink-0 rounded-[100px] px-4 py-2.5 text-[12px] font-medium [-webkit-tap-highlight-color:transparent]"
                style={{
                  minHeight: 44,
                  background: on ? "#0f2318" : "#f0f0f0",
                  color: on ? "#fff" : "#888",
                  border: "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="px-3.5" style={{ paddingLeft: 14, paddingRight: 14 }}>
          <p
            className="mb-2.5 font-semibold uppercase text-[#888]"
            style={{ fontSize: 10, letterSpacing: "0.12em" }}
          >
            {loading ? "…" : `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`}
          </p>

          {error ? (
            <div
              className="mb-3 rounded-[10px] p-4 text-[14px] text-[#111]"
              style={{ border: "0.5px solid #e0e0e0", background: "#f9f9f9" }}
            >
              <p className="font-medium">Something went wrong</p>
              <p className="mt-1 text-[13px] text-[#555]">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <p className="py-10 text-center text-[13px] text-[#888]">Loading…</p>
          ) : projects.length === 0 ? (
            <div
              className="rounded-[10px] px-5 py-12 text-center"
              style={{ border: "0.5px solid #e0e0e0" }}
            >
              <p className="text-[15px] font-medium text-[#111]">No projects yet</p>
              <p className="mt-2 text-[13px] text-[#888]">
                Create one from the workspace, then manage details here.
              </p>
              <Link
                href="/final"
                prefetch={false}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[100px] bg-[#0f2318] px-5 text-[12px] font-medium text-white no-underline"
              >
                Open workspace
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="rounded-[10px] px-5 py-12 text-center"
              style={{ border: "0.5px solid #e0e0e0" }}
            >
              <p className="text-[15px] font-medium text-[#111]">No projects match</p>
              <p className="mt-2 text-[13px] text-[#888]">
                Try another filter or search.
              </p>
            </div>
          ) : (
            <ul className="list-none p-0">
              {filtered.map((p, idx) => {
                const cat = workflowBucket(p);
                const st = statusPresentation(cat);
                const thumbBg = THUMB_BG[idx % THUMB_BG.length];
                const initial = (clientDisplayName(p)[0] || "?").toUpperCase();
                const addr = (p.address ?? "").trim() || "—";

                return (
                  <li
                    key={p.id}
                    className="relative overflow-hidden rounded-[10px] bg-white"
                    style={{ border: "0.5px solid #e0e0e0", marginBottom: 10 }}
                  >
                    <div className="flex flex-row">
                      <div
                        className="flex h-[90px] w-[90px] shrink-0 items-center justify-center"
                        style={{ background: thumbBg }}
                      >
                        <span
                          className={`text-[28px] font-medium ${plexMono.className}`}
                          style={{ color: "rgba(255,255,255,0.25)" }}
                        >
                          {initial}
                        </span>
                      </div>
                      <div className="relative flex min-w-0 flex-1 flex-col py-3 pl-3 pr-2" style={{ padding: "12px 10px 12px 12px" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="absolute right-1 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-[#888] [-webkit-tap-highlight-color:transparent]"
                          aria-label={`Edit ${p.name}`}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <p className="text-[11px] text-[#888]">{clientDisplayName(p)}</p>
                        <p className="truncate text-[14px] font-medium text-[#111]">{p.name}</p>
                        <p className="truncate text-[11px] text-[#aaa]">{addr}</p>
                        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: st.dot, width: 6, height: 6 }}
                              aria-hidden
                            />
                            <span
                              className="truncate text-[10px] font-semibold uppercase"
                              style={{ letterSpacing: "0.06em", color: st.color }}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                            <span className={`text-[13px] font-medium text-[#111] ${plexMono.className}`}>
                              —
                            </span>
                            <span className="text-[10px] text-[#aaa]">{daysLabel(p)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex flex-row flex-wrap gap-2"
                      style={{
                        borderTop: "0.5px solid #f0f0f0",
                        padding: "8px 12px",
                        gap: 8,
                      }}
                    >
                      <Link
                        href="/final"
                        prefetch={false}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[100px] bg-white px-3 text-[11px] font-medium text-[#555] no-underline [-webkit-tap-highlight-color:transparent]"
                        style={{ border: "0.5px solid #e0e0e0", flex: "1 1 90px" }}
                      >
                        View Quote
                      </Link>
                      <Link
                        href="/final"
                        prefetch={false}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[100px] bg-white px-3 text-[11px] font-medium text-[#555] no-underline [-webkit-tap-highlight-color:transparent]"
                        style={{ border: "0.5px solid #e0e0e0", flex: "1 1 90px" }}
                      >
                        Timeline
                      </Link>
                      <Link
                        href="/final"
                        prefetch={false}
                        className="inline-flex min-h-[44px] flex-[1.1] items-center justify-center gap-1 rounded-[100px] bg-[#0f2318] px-3 text-[11px] font-medium text-white no-underline [-webkit-tap-highlight-color:transparent]"
                        style={{ flex: "1.1 1 100px" }}
                      >
                        Open <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

        <nav
          className="relative z-[10100] flex shrink-0 flex-row items-center justify-between border-t bg-white md:hidden"
          style={{
            borderTop: "0.5px solid #e0e0e0",
            padding: `10px 4px max(8px, env(safe-area-inset-bottom, 0px))`,
            boxShadow: "none",
          }}
          aria-label="Main"
        >
          <Link
            href="/final"
            prefetch={false}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 bg-transparent px-0.5 text-[#aaa] no-underline [-webkit-tap-highlight-color:transparent]"
          >
            <span className="flex h-7 w-7 items-center justify-center text-current" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z" />
              </svg>
            </span>
            <span className="max-w-full truncate text-[9px] font-medium uppercase tracking-wide">Home</span>
          </Link>

          <div className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[#0f2318]">
            <span className="flex h-7 w-7 items-center justify-center text-current" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.25" />
                <rect x="14" y="3" width="7" height="7" rx="1.25" />
                <rect x="3" y="14" width="7" height="7" rx="1.25" />
                <rect x="14" y="14" width="7" height="7" rx="1.25" />
              </svg>
            </span>
            <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wide text-[#0f2318]">
              Projects
            </span>
          </div>

          <div className="relative z-[12] flex min-w-0 flex-1 flex-col items-center justify-center">
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
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0f2318] text-white shadow-[0_4px_16px_rgba(15,35,24,0.35)] transition [-webkit-tap-highlight-color:transparent]"
              style={{
                border: "3px solid #fff",
                transform: fabOpen ? "rotate(45deg)" : undefined,
                transition: "transform .35s cubic-bezier(.34,1.56,.64,1)",
              }}
              aria-expanded={fabOpen}
              aria-haspopup="true"
              aria-label="New job"
              onClick={() => setFabOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <span
              className="mt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-[#0f2318]"
              style={{ letterSpacing: "0.05em" }}
              aria-hidden
            >
              New Job
            </span>
          </div>

          <Link
            href="/final"
            prefetch={false}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 bg-transparent px-0.5 text-[#aaa] no-underline [-webkit-tap-highlight-color:transparent]"
          >
            <span className="flex h-7 w-7 items-center justify-center text-current" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3h7l5 5v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="12" y2="17" />
              </svg>
            </span>
            <span className="max-w-full truncate text-[9px] font-medium uppercase tracking-wide">Quote</span>
          </Link>

          <Link
            href="/final"
            prefetch={false}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 bg-transparent px-0.5 text-[#aaa] no-underline [-webkit-tap-highlight-color:transparent]"
          >
            <span className="flex h-7 w-7 items-center justify-center text-current" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="max-w-full truncate text-[9px] font-medium uppercase tracking-wide">Clients</span>
          </Link>
        </nav>
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/35 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title"
          onClick={() => !saving && closeEdit()}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[10px] bg-white sm:rounded-[10px]"
            style={{ border: "0.5px solid #e0e0e0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#f0f0f0] px-5 py-4" style={{ borderBottomWidth: 0.5 }}>
              <h2 id="edit-project-title" className="text-lg font-medium text-[#111]">
                Edit project
              </h2>
              <p className="mt-1 text-[12px] text-[#888]">Changes apply to this job everywhere in RenoFlow.</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              {formError ? (
                <div className="rounded-[10px] p-3 text-[13px]" style={{ border: "0.5px solid #e0e0e0", background: "#f9f9f9" }}>
                  <p className="font-medium text-[#111]">Could not save</p>
                  <p className="mt-1 text-[#555]">{formError}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-name" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Project name
                </label>
                <input
                  id="pf-name"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  autoComplete="off"
                  className="min-h-[44px] rounded-[10px] px-3 text-[15px] text-[#111] outline-none"
                  style={{ border: "0.5px solid #e0e0e0" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-client" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Linked client
                </label>
                <select
                  id="pf-client"
                  value={fClientId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFClientId(v);
                    const hit = clients.find((c) => c.id === v);
                    if (hit) setFClientName(hit.full_name);
                  }}
                  className="min-h-[44px] rounded-[10px] bg-white px-3 text-[15px] text-[#111] outline-none"
                  style={{ border: "0.5px solid #e0e0e0" }}
                >
                  <option value="">None — use display name below</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                      {c.email ? ` — ${c.email}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#888]">
                  Pick a saved client to connect this job, or leave empty for a one-off label only.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-cname" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Client display name
                </label>
                <input
                  id="pf-cname"
                  value={fClientName}
                  onChange={(e) => setFClientName(e.target.value)}
                  placeholder="Label on quotes & invoices"
                  autoComplete="off"
                  className="min-h-[44px] rounded-[10px] px-3 text-[15px] text-[#111] outline-none"
                  style={{ border: "0.5px solid #e0e0e0" }}
                />
              </div>
              {fClientId ? (
                (() => {
                  const ld = clients.find((c) => c.id === fClientId);
                  if (!ld) return null;
                  return (
                    <div className="rounded-[10px] p-3 text-[12px] text-[#555]" style={{ border: "0.5px solid #e0e0e0", background: "#f9f9f9" }}>
                      <div className="mb-1 font-medium text-[#111]">Connected client</div>
                      {ld.email ? <div>✉ {ld.email}</div> : null}
                      {ld.phone ? <div>☎ {ld.phone}</div> : null}
                      {ld.address ? <div>📍 {ld.address}</div> : null}
                    </div>
                  );
                })()
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-addr" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Job address
                </label>
                <input
                  id="pf-addr"
                  value={fAddress}
                  onChange={(e) => setFAddress(e.target.value)}
                  autoComplete="street-address"
                  className="min-h-[44px] rounded-[10px] px-3 text-[15px] text-[#111] outline-none"
                  style={{ border: "0.5px solid #e0e0e0" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-quote" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Quote number
                </label>
                <input
                  id="pf-quote"
                  value={fQuote}
                  onChange={(e) => setFQuote(e.target.value)}
                  autoComplete="off"
                  className={`min-h-[44px] rounded-[10px] px-3 text-[15px] text-[#111] outline-none ${plexMono.className}`}
                  style={{ border: "0.5px solid #e0e0e0" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pf-notes" className="text-[11px] font-medium uppercase text-[#888]" style={{ letterSpacing: "0.08em" }}>
                  Notes
                </label>
                <textarea
                  id="pf-notes"
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  rows={4}
                  className="rounded-[10px] px-3 py-2 text-[15px] text-[#111] outline-none"
                  style={{ border: "0.5px solid #e0e0e0" }}
                />
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-t border-[#f0f0f0] px-5 py-4" style={{ borderTopWidth: 0.5 }}>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center justify-center rounded-[100px] bg-white px-4 text-[12px] font-medium text-[#c0392b] [-webkit-tap-highlight-color:transparent] disabled:opacity-50"
                style={{ border: "0.5px solid #e0e0e0" }}
                disabled={saving || deletingId === editing.id}
                onClick={() => {
                  if (!editing || saving) return;
                  if (typeof window !== "undefined" && !window.confirm("Delete this project? This cannot be undone.")) return;
                  void deleteProject(editing);
                }}
              >
                {deletingId === editing?.id ? "…" : "Delete"}
              </button>
              <div className="flex flex-1 flex-row justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[100px] bg-white px-5 text-[12px] font-medium text-[#555] [-webkit-tap-highlight-color:transparent]"
                  style={{ border: "0.5px solid #e0e0e0" }}
                  disabled={saving}
                  onClick={closeEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[100px] bg-[#0f2318] px-5 text-[12px] font-medium text-white [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
