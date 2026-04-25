"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
  client: ClientRow | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
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
  // Linked to a client row in DB but join failed (rare) — don't say "not linked".
  if (p.client_id) return name;
  // Name stored on the project only — no clients row FK.
  return `${name} (not linked)`;
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

  return (
    <div id="shell">
      <aside id="sb">
        <div className="logo">
          <div className="logo-full">
            <div className="logo-t">RenoFlow</div>
            <div className="logo-s">Renovation Calculator</div>
          </div>
          <div className="logo-rf">RF</div>
        </div>

        <div className="pi">
          <div className="pi-l">Overview</div>
          <div className="pi-n">{loading ? "…" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}</div>
          <div className="pi-c">{clients.length} saved client{clients.length === 1 ? "" : "s"}</div>
        </div>

        <nav className="nav">
          <div className="ns">Navigate</div>
          <Link href="/final" className="ni">
            <span className="ni-i">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="1.5" y="1.5" width="6" height="6" rx="1.2" />
                <rect x="9.5" y="1.5" width="6" height="6" rx="1.2" />
                <rect x="1.5" y="9.5" width="6" height="6" rx="1.2" />
                <rect x="9.5" y="9.5" width="6" height="6" rx="1.2" />
              </svg>
            </span>
            <span className="ni-l">Workspace</span>
          </Link>
          <div className="ni on">
            <span className="ni-i">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 5.5h11M3 8.5h11M3 11.5h8" />
                <rect x="1.5" y="2.5" width="14" height="12" rx="1.5" />
              </svg>
            </span>
            <span className="ni-l">Active projects</span>
            <span className="ni-b">{projects.length}</span>
          </div>
        </nav>

        <div className="sb-tot">
          <div className="tot-l">Signed in</div>
          <div className="tot-b">Manage jobs &amp; clients</div>
        </div>
      </aside>

      <div id="main">
        <div
          className="ph"
          style={{ borderBottom: "1px solid #d9d9d9", paddingBottom: 16, alignItems: "flex-start" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
            <span className="text-[var(--ac)]" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.25" />
                <rect x="14" y="3" width="7" height="7" rx="1.25" />
                <rect x="3" y="14" width="7" height="7" rx="1.25" />
                <rect x="14" y="14" width="7" height="7" rx="1.25" />
              </svg>
            </span>
            <div>
            <div className="pt">
              Active{" "}
              <em className="font-semibold not-italic" style={{ color: "var(--ac)" }}>
                Projects
              </em>
            </div>
            <p className="ps">Edit jobs, link saved clients, and keep quote numbers aligned with the calculator.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/final" className="btn bp sm" prefetch={false}>
              ← Workspace
            </Link>
            <a href="/api/auth/logout" className="btn bg sm">
              Sign out
            </a>
          </div>
        </div>

        <div className="pc">
          {!loading && !error && projects.length > 0 ? (
            <div className="brief-wrap">
              <div className="brief-header">
                <div className="brief-date">Project registry</div>
                <div className="brief-greeting">Everything in one place</div>
                <div className="brief-sub">
                  Same data as the workspace — update here or in the calculator; it stays in sync via Supabase.
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="alert-card urgent" style={{ marginBottom: 20 }}>
              <div className="alert-i">!</div>
              <div className="alert-body">
                <div className="alert-t">Something went wrong</div>
                <div className="alert-s">{error}</div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="sc" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div className="brief-stat-l" style={{ marginBottom: 8 }}>
                Loading
              </div>
              <div className="brief-stat-v" style={{ fontSize: 18 }}>
                …
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="empty">
              <div className="empty-i">📂</div>
              <div className="cl-empty-t">No projects yet</div>
              <div className="cl-empty-s">Create one from the workspace sidebar, then return here to manage details.</div>
              <Link href="/final" className="btn bp sm" style={{ marginTop: 18 }} prefetch={false}>
                Open workspace
              </Link>
            </div>
          ) : (
            <>
              <div className="dg" style={{ marginBottom: 22 }}>
                <div className="sc">
                  <div className="sc-l">Projects</div>
                  <div className="sc-v">{projects.length}</div>
                  <div className="sc-s">active jobs in your account</div>
                </div>
                <div className="sc">
                  <div className="sc-l">Clients</div>
                  <div className="sc-v">{clients.length}</div>
                  <div className="sc-s">contacts you can link to jobs</div>
                </div>
                <div className="sc">
                  <div className="sc-l">Registry</div>
                  <div className="sc-v" style={{ fontSize: 20 }}>
                    Live
                  </div>
                  <div className="sc-s">edits save to the database</div>
                </div>
              </div>

              <div className="proj-table-wrap">
                <div className="proj-table-scroll">
                  <table className="proj-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Client</th>
                        <th>Address</th>
                        <th>Quote</th>
                        <th>Updated</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id}>
                          <td className="proj-name">{p.name}</td>
                          <td>
                            <span title={clientSummary(p)}>{clientSummary(p)}</span>
                          </td>
                          <td style={{ maxWidth: 200 }}>{p.address || "—"}</td>
                          <td className="proj-mono">{p.quote_number ?? "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--tx3)", whiteSpace: "nowrap" }}>
                            {formatWhen(p.updated_at)}
                          </td>
                          <td className="proj-actions">
                            <button type="button" className="btn bp sm" onClick={() => openEdit(p)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="bd-btn btn sm"
                              style={{ marginLeft: 8 }}
                              disabled={deletingId === p.id}
                              onClick={() => void deleteProject(p)}
                            >
                              {deletingId === p.id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="proj-mobile-list">
                {projects.map((p) => (
                  <div key={p.id} className="proj-mcard">
                    <div className="proj-mcard-top">
                      <div>
                        <div className="proj-mcard-name">{p.name}</div>
                        <div className="proj-mcard-meta">{clientSummary(p)}</div>
                        {p.address ? <div className="proj-mcard-meta">{p.address}</div> : null}
                      </div>
                    </div>
                    <div className="proj-mcard-foot">
                      <span className="proj-mono">{p.quote_number ?? "—"}</span>
                      <span style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn bp sm" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="bd-btn btn sm"
                          disabled={deletingId === p.id}
                          onClick={() => void deleteProject(p)}
                        >
                          {deletingId === p.id ? "…" : "Delete"}
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div
          className="mo show"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title"
          onClick={() => !saving && closeEdit()}
        >
          <div className="mb proj-mb-wide" onClick={(e) => e.stopPropagation()}>
            <div className="mb-t" id="edit-project-title">
              Edit project
            </div>
            <p style={{ fontSize: 12, color: "var(--tx3)", marginTop: -8, marginBottom: 16 }}>
              Changes apply to this job everywhere in RenoFlow.
            </p>

            {formError ? (
              <div className="alert-card urgent" style={{ marginBottom: 14 }}>
                <div className="alert-i">!</div>
                <div className="alert-body">
                  <div className="alert-t">Could not save</div>
                  <div className="alert-s">{formError}</div>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="pf-name">Project name</label>
              <input
                id="pf-name"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="pf-client">Linked client</label>
              <select
                id="pf-client"
                value={fClientId}
                onChange={(e) => {
                  const v = e.target.value;
                  setFClientId(v);
                  const hit = clients.find((c) => c.id === v);
                  if (hit) setFClientName(hit.full_name);
                }}
              >
                <option value="">None — use display name below</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.email ? ` — ${c.email}` : ""}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 6 }}>
                Pick a saved client to connect this job, or leave empty for a one-off label only.
              </p>
            </div>
            <div className="field">
              <label htmlFor="pf-cname">Client display name</label>
              <input
                id="pf-cname"
                value={fClientName}
                onChange={(e) => setFClientName(e.target.value)}
                placeholder="Label on quotes & invoices"
                autoComplete="off"
              />
            </div>
            {fClientId ? (
              (() => {
                const ld = clients.find((c) => c.id === fClientId);
                if (!ld) return null;
                return (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "var(--sf2)",
                      border: "1px solid var(--bd)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--tx2)",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--tx)", marginBottom: 4 }}>Connected client</div>
                    {ld.email ? <div>✉ {ld.email}</div> : null}
                    {ld.phone ? <div>☎ {ld.phone}</div> : null}
                    {ld.address ? <div>📍 {ld.address}</div> : null}
                  </div>
                );
              })()
            ) : null}
            <div className="field">
              <label htmlFor="pf-addr">Job address</label>
              <input id="pf-addr" value={fAddress} onChange={(e) => setFAddress(e.target.value)} autoComplete="street-address" />
            </div>
            <div className="field">
              <label htmlFor="pf-quote">Quote number</label>
              <input
                id="pf-quote"
                style={{ fontFamily: "'DM Mono', monospace" }}
                value={fQuote}
                onChange={(e) => setFQuote(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="pf-notes">Notes</label>
              <textarea id="pf-notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={4} />
            </div>

            <div className="mb-b">
              <button type="button" className="btn bg sm" disabled={saving} onClick={closeEdit}>
                Cancel
              </button>
              <button type="button" className="btn bp sm" disabled={saving} onClick={() => void saveEdit()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
