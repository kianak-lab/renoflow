"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "@/components/sign-out-button";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  quote_number: string;
  updated_at: string;
};

type Room = {
  id: string;
  project_id: string;
  name: string;
  icon: string | null;
};

type Invoice = {
  id: string;
  project_id: string;
  invoice_number: string;
  total_amount: number | null;
  paid: boolean;
  void: boolean;
  sent_date: string | null;
};

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type Props = {
  userEmail: string;
  initialProjects: Project[];
  initialRooms: Room[];
  initialInvoices: Invoice[];
  initialClients: Client[];
  projectsError: boolean;
};

const ROOM_TYPES = [
  { n: "Kitchen", ic: "🍳", trades: ["demo", "framing", "electrical", "plumbing", "drywall", "tile", "flooring", "painting", "trim", "cabinets"] },
  { n: "Bathroom", ic: "🚿", trades: ["demo", "framing", "electrical", "plumbing", "insulation", "drywall", "tile", "painting", "trim"] },
  { n: "Bedroom", ic: "🛏", trades: ["demo", "electrical", "insulation", "drywall", "flooring", "painting", "trim"] },
  { n: "Living Room", ic: "🛋", trades: ["demo", "electrical", "drywall", "flooring", "painting", "trim"] },
  { n: "Basement", ic: "⬇", trades: ["demo", "framing", "electrical", "plumbing", "hvac", "insulation", "drywall", "flooring", "painting", "trim"] },
  { n: "Laundry", ic: "🫧", trades: ["demo", "electrical", "plumbing", "drywall", "flooring", "painting", "trim"] },
  { n: "Garage", ic: "🚗", trades: ["demo", "electrical", "drywall", "flooring", "painting"] },
  { n: "Whole House", ic: "🏠", trades: ["demo", "framing", "electrical", "plumbing", "hvac", "insulation", "drywall", "tile", "flooring", "painting", "trim", "cabinets"] },
  { n: "Custom", ic: "✏", trades: ["demo", "framing", "electrical", "plumbing", "hvac", "insulation", "drywall", "tile", "flooring", "painting", "trim", "cabinets"] },
] as const;

const TRADE_NAMES: Record<string, string> = {
  demo: "Demolition",
  framing: "Framing",
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  insulation: "Insulation",
  drywall: "Drywall",
  tile: "Tile",
  flooring: "Flooring",
  painting: "Painting",
  trim: "Trim & Millwork",
  cabinets: "Cabinets",
};

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatSupabaseError(error: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}) {
  return [
    error.message,
    error.code ? `code: ${error.code}` : "",
    error.details ? `details: ${error.details}` : "",
    error.hint ? `hint: ${error.hint}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function DashboardShell({
  userEmail,
  initialProjects,
  initialRooms,
  initialInvoices,
  initialClients,
  projectsError,
}: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [rooms, setRooms] = useState(initialRooms);
  const [invoices] = useState(initialInvoices);
  const [clients, setClients] = useState(initialClients);
  const [currentPage, setCurrentPage] = useState<"dash" | "clients">("dash");
  const [wizardOpen, setWizardOpen] = useState(initialProjects.length === 0);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("My Renovation");
  const [projectAddress, setProjectAddress] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [savePulse, setSavePulse] = useState(false);
  const [clientForm, setClientForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const activeProject = projects[0] ?? null;
  const activeProjectRooms = useMemo(
    () => rooms.filter((room) => room.project_id === activeProject?.id),
    [rooms, activeProject?.id],
  );

  const totalInvoiceValue = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total_amount ?? 0),
    0,
  );
  const outstanding = invoices.reduce((sum, invoice) => {
    if (invoice.void || invoice.paid) return sum;
    return sum + Number(invoice.total_amount ?? 0);
  }, 0);
  const collected = invoices.reduce((sum, invoice) => {
    if (!invoice.paid || invoice.void) return sum;
    return sum + Number(invoice.total_amount ?? 0);
  }, 0);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function triggerSaved() {
    setSavePulse(true);
    window.setTimeout(() => setSavePulse(false), 1200);
  }

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return (parts[0]?.[0] ?? "?").toUpperCase();
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFormError("Session expired. Please sign in again.");
        return;
      }

      const quoteNumber = `Q-${String(projects.length + 1).padStart(3, "0")}`;
      const selectedClient = clients.find((cl) => cl.id === clientId);
      const payload = {
        user_id: user.id,
        name: projectName.trim() || "My Renovation",
        client_id: clientId || null,
        client_name: (selectedClient?.full_name ?? clientName.trim()) || null,
        address: projectAddress.trim() || selectedClient?.address || null,
        quote_number: quoteNumber,
      };

      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select("id,name,client_name,address,quote_number,updated_at")
        .single();

      if (error) {
        setFormError(error.message);
        return;
      }

      setProjects((prev) => [data, ...prev]);
      setRooms((prev) => prev.filter((room) => room.project_id !== data.id));
      setWizardOpen(false);
      triggerSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  function openRoomModal() {
    if (!activeProject) {
      setWizardOpen(true);
      return;
    }
    setRoomModalOpen(true);
  }

  async function addRoom(typeIndex: number) {
    if (!activeProject) {
      setWizardOpen(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const type = ROOM_TYPES[typeIndex];
      const existing = activeProjectRooms.filter((room) =>
        room.name.startsWith(type.n),
      ).length;
      const roomName = existing > 0 ? `${type.n} ${existing + 1}` : type.n;

      const { data: roomInsert, error: roomErr } = await supabase
        .from("project_rooms")
        .insert({
          project_id: activeProject.id,
          name: roomName,
          icon: type.ic,
          sort_order: activeProjectRooms.length,
          dimensions: {},
        })
        .select("id,project_id,name,icon")
        .single();

      if (roomErr || !roomInsert) {
        setFormError(roomErr?.message ?? "Could not add room.");
        return;
      }

      const roomTrades = type.trades.map((tradeId, index) => ({
        room_id: roomInsert.id,
        trade_id: tradeId,
        display_name: TRADE_NAMES[tradeId] ?? tradeId,
        sort_order: index,
      }));

      const { data: insertedTrades, error: tradeErr } = await supabase
        .from("project_room_trades")
        .insert(roomTrades)
        .select("id,trade_id");

      if (tradeErr) {
        setFormError(tradeErr.message);
        return;
      }

      if ((insertedTrades ?? []).length > 0) {
        const tradeIds = insertedTrades?.map((trade) => trade.trade_id) ?? [];
        const { data: catalogItems } = await supabase
          .from("trade_catalog_items")
          .select("trade_id,code,label,unit,unit_price,sort_order")
          .in("trade_id", tradeIds);

        if (catalogItems && catalogItems.length > 0) {
          const byTrade = new Map<string, string>();
          insertedTrades?.forEach((trade) => byTrade.set(trade.trade_id, trade.id));
          const itemsPayload = catalogItems
            .map((item) => {
              const roomTradeId = byTrade.get(item.trade_id);
              if (!roomTradeId) return null;
              return {
                room_trade_id: roomTradeId,
                code: item.code,
                label: item.label,
                unit: item.unit,
                unit_price: item.unit_price,
                sort_order: item.sort_order,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          if (itemsPayload.length > 0) {
            await supabase.from("project_trade_items").insert(itemsPayload);
          }
        }
      }

      setRooms((prev) => [...prev, roomInsert]);
      setRoomModalOpen(false);
      triggerSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not add room.");
    } finally {
      setSaving(false);
    }
  }

  function openNewClientModal() {
    setEditingClientId(null);
    setClientForm({
      full_name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setClientModalOpen(true);
    setFormError(null);
    setClientFormError(null);
  }

  function openEditClientModal(client: Client) {
    setEditingClientId(client.id);
    setClientForm({
      full_name: client.full_name ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      notes: client.notes ?? "",
    });
    setClientModalOpen(true);
    setFormError(null);
    setClientFormError(null);
  }

  async function saveClient(e: FormEvent) {
    e.preventDefault();
    if (!clientForm.full_name.trim()) {
      setClientFormError("Client name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    setClientFormError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setClientFormError("Session expired. Please sign in again.");
        return;
      }

      const payload = {
        user_id: user.id,
        full_name: clientForm.full_name.trim(),
        phone: clientForm.phone.trim() || null,
        email: clientForm.email.trim() || null,
        address: clientForm.address.trim() || null,
        notes: clientForm.notes.trim() || null,
      };

      if (editingClientId) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingClientId)
          .select("id,full_name,phone,email,address,notes")
          .single();
        if (error || !data) {
          setClientFormError(
            error ? formatSupabaseError(error) : "Could not update client.",
          );
          return;
        }
        setClients((prev) => prev.map((client) => (client.id === data.id ? data : client)));
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert(payload)
          .select("id,full_name,phone,email,address,notes")
          .single();
        if (error || !data) {
          setClientFormError(
            error ? formatSupabaseError(error) : "Could not create client.",
          );
          return;
        }
        setClients((prev) => [data, ...prev]);
      }

      setClientModalOpen(false);
      triggerSaved();
    } catch (error) {
      setClientFormError(
        error instanceof Error ? error.message : "Could not save client.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: Client) {
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) {
        setFormError(formatSupabaseError(error));
        return;
      }
      setClients((prev) => prev.filter((item) => item.id !== client.id));
      setProjects((prev) =>
        prev.map((project) =>
          project.client_name === client.full_name
            ? { ...project, client_name: null }
            : project,
        ),
      );
      triggerSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not delete client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div id="sind" className={savePulse ? "show" : ""}>
        Saved
      </div>
      <div id="shell">
        <div id="sb">
          <div className="logo">
            <div className="logo-full">
              <div className="logo-t">RenoFlow</div>
              <div className="logo-s">Renovation Calculator</div>
            </div>
            <div className="logo-rf">RF</div>
          </div>
          <nav className="nav">
            <div className="ns">Your Business</div>
            <button
              className={`ni ${currentPage === "dash" ? "on" : ""}`}
              data-pg="dash"
              type="button"
              onClick={() => setCurrentPage("dash")}
            >
              <span className="ni-i">⬡</span>
              <span className="ni-l">Dashboard</span>
            </button>
            <button
              className={`ni ${currentPage === "clients" ? "on" : ""}`}
              type="button"
              onClick={() => setCurrentPage("clients")}
            >
              <span className="ni-i">👥</span>
              <span className="ni-l">Clients</span>
              <span className="ni-b">{clients.length}</span>
            </button>
            <div className="ni">
              <span className="ni-i">⚙</span>
              <span className="ni-l">Settings</span>
            </div>
            <div className="ns-div" />
            <div className="ns">The Job</div>
            <button className="ni" onClick={openRoomModal} type="button">
              <span className="ni-i">🏠</span>
              <span className="ni-l">Rooms</span>
              <span className="ni-b">{activeProjectRooms.length}</span>
            </button>
            <div className="ns-div" />
            <div className="ns">Send & Get Paid</div>
            <div className="ni">
              <span className="ni-i">📄</span>
              <span className="ni-l">Quote</span>
            </div>
            <div className="ni">
              <span className="ni-i">🧾</span>
              <span className="ni-l">Invoices</span>
              <span className="ni-b">{invoices.length}</span>
            </div>
          </nav>
          <div className="sb-tot">
            <div className="tot-l">Project Total</div>
            <div className="tot-a">{money(totalInvoiceValue)}</div>
            <div className="tot-b">
              {activeProjectRooms.length} room{activeProjectRooms.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div id="main">
          <div
            id="topbar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "var(--topbar-bg)",
              borderBottom: "1px solid var(--bd)",
              flexShrink: 0,
            }}
          >
            <div id="topbar-logo" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div id="topbar-logo-img" />
              <div
                id="topbar-co-name"
                style={{
                  fontFamily: "'DM Serif Display',serif",
                  fontSize: 16,
                  color: "var(--ac)",
                }}
              >
                RenoFlow
              </div>
            </div>
            <div
              id="topbar-right"
              style={{
                fontSize: 11,
                color: "var(--tx3)",
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {dateStr}
            </div>
          </div>

          <div id="p-dash" style={{ display: currentPage === "dash" ? "" : "none" }}>
            <div className="ph">
              <div>
                <div className="pt">
                  {activeProject?.name ?? "My Renovation"}
                  {activeProject?.client_name ? (
                    <>
                      <br />
                      <em>{activeProject.client_name}</em>
                    </>
                  ) : null}
                </div>
                {activeProject?.address ? <div className="ps">{activeProject.address}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn bg sm" type="button" onClick={openRoomModal}>
                  + Room
                </button>
                <button className="btn bp sm" type="button" onClick={() => setWizardOpen(true)}>
                  {activeProject ? "Edit Project" : "Create Project"}
                </button>
              </div>
            </div>

            <div className="pc">
              {projectsError ? (
                <div className="alert-card warning">
                  <div className="alert-i">⚠️</div>
                  <div className="alert-body">
                    <div className="alert-t">Database setup required</div>
                    <div className="alert-s">Run web/supabase/schema.sql in Supabase, then refresh.</div>
                  </div>
                </div>
              ) : (
                <div className="brief-wrap">
                  <div className="brief-header">
                    <div
                      style={{
                        fontFamily: "'DM Serif Display',serif",
                        fontSize: 20,
                        marginBottom: 8,
                        opacity: 0.95,
                      }}
                    >
                      RenoFlow
                    </div>
                    <div className="brief-date">{dateStr}</div>
                    <div className="brief-greeting">{greeting}</div>
                    <div className="brief-sub">
                      {activeProjectRooms.length > 0
                        ? `${activeProjectRooms.length} room${activeProjectRooms.length === 1 ? "" : "s"} active`
                        : `Signed in as ${userEmail}`}
                    </div>
                  </div>

                  <div className="brief-stats">
                    <div className="brief-stat">
                      <div className="brief-stat-v" style={{ color: "var(--ac)" }}>
                        {money(totalInvoiceValue)}
                      </div>
                      <div className="brief-stat-l">Project Value</div>
                    </div>
                    <div className="brief-stat">
                      <div className="brief-stat-v" style={{ color: "var(--red)" }}>
                        {money(outstanding)}
                      </div>
                      <div className="brief-stat-l">Outstanding</div>
                    </div>
                    <div className="brief-stat">
                      <div className="brief-stat-v" style={{ color: "var(--grn)" }}>
                        {money(collected)}
                      </div>
                      <div className="brief-stat-l">Collected</div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--tx3)",
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      fontFamily: "'DM Mono',monospace",
                      marginBottom: 8,
                    }}
                  >
                    Active Project
                  </div>
                  <div className="rg">
                    {activeProjectRooms.map((room) => (
                      <div className="rc" key={room.id}>
                        <div className="rc-i">{room.icon ?? "🏠"}</div>
                        <div className="rc-n">{room.name}</div>
                        <div className="rc-d">Tap to estimate</div>
                      </div>
                    ))}
                    <button className="arc" onClick={openRoomModal} type="button">
                      <div style={{ fontSize: 22, marginBottom: 5 }}>+</div>
                      <div style={{ fontSize: 13 }}>Add Room</div>
                    </button>
                  </div>

                  <div className="brief-quick">
                    <div className="brief-quick-t">Quick Actions</div>
                    <div className="brief-quick-btns">
                      <button className="btn bp sm" type="button" onClick={openRoomModal}>
                        + Add Room
                      </button>
                      <button className="btn bg sm" type="button" onClick={() => setWizardOpen(true)}>
                        {activeProject ? "Project Details" : "Create Project"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {formError ? (
                <p className="alert-s" style={{ marginTop: 12, color: "var(--red)" }}>
                  {formError}
                </p>
              ) : null}
              <div style={{ marginTop: 16 }}>
                <SignOutButton />
              </div>
            </div>
          </div>
          <div id="p-clients" style={{ display: currentPage === "clients" ? "" : "none" }}>
            <div className="ph">
              <div>
                <div className="pt">
                  Client <em>Database</em>
                </div>
                <div className="ps">
                  {clients.length} client{clients.length === 1 ? "" : "s"}
                </div>
              </div>
              <button className="btn bp sm" type="button" onClick={openNewClientModal}>
                + New Client
              </button>
            </div>
            <div className="pc">
              {formError ? (
                <div className="alert-card warning" style={{ marginBottom: 12 }}>
                  <div className="alert-i">⚠️</div>
                  <div className="alert-body">
                    <div className="alert-t">Client action failed</div>
                    <div className="alert-s">{formError}</div>
                  </div>
                </div>
              ) : null}
              {clients.length === 0 ? (
                <div className="cl-empty">
                  <div className="cl-empty-i">👥</div>
                  <div className="cl-empty-t">No clients yet</div>
                  <div className="cl-empty-s">Add your first client to get started</div>
                </div>
              ) : (
                <div className="cl-grid">
                  {clients.map((client) => (
                    <div className="cl-card" key={client.id}>
                      <div className="cl-card-top">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                          <div className="cl-avatar">{initials(client.full_name)}</div>
                          <div>
                            <div className="cl-name">{client.full_name}</div>
                            <div className="cl-meta">
                              {client.phone || client.email || "No contact info"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="cl-detail">
                        {client.email ? <span>✉️ {client.email}</span> : null}
                        {client.phone ? <span>📞 {client.phone}</span> : null}
                        {client.address ? <span>📍 {client.address}</span> : null}
                        {client.notes ? (
                          <span style={{ color: "var(--tx3)", fontStyle: "italic" }}>{client.notes}</span>
                        ) : null}
                      </div>
                      <div className="cl-actions">
                        <button className="btn bp sm" type="button" onClick={() => openEditClientModal(client)}>
                          Edit
                        </button>
                        <button className="btn bd-btn sm" type="button" onClick={() => deleteClient(client)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav id="mob-nav" className="mob-nav" aria-label="Main">
        <div className="mob-nav-in">
          <button
            type="button"
            className={`mob-ni ${currentPage === "dash" ? "on" : ""}`}
            onClick={() => setCurrentPage("dash")}
            aria-current={currentPage === "dash" ? "page" : undefined}
          >
            <span className="mob-ni-ic">
              <span className="mob-ni-i" aria-hidden>⬡</span>
            </span>
            <span className="mob-ni-l">Home</span>
          </button>
          <button
            type="button"
            className={`mob-ni ${currentPage === "clients" ? "on" : ""}`}
            onClick={() => setCurrentPage("clients")}
            aria-current={currentPage === "clients" ? "page" : undefined}
          >
            <span className="mob-ni-ic">
              <span className="mob-ni-i" aria-hidden>👥</span>
              {clients.length > 0 ? <span className="mob-ni-b">{clients.length}</span> : null}
            </span>
            <span className="mob-ni-l">Clients</span>
          </button>
          <button type="button" className="mob-ni" onClick={openRoomModal}>
            <span className="mob-ni-ic">
              <span className="mob-ni-i" aria-hidden>🏠</span>
              {activeProjectRooms.length > 0 ? (
                <span className="mob-ni-b">{activeProjectRooms.length}</span>
              ) : null}
            </span>
            <span className="mob-ni-l">Rooms</span>
          </button>
        </div>
      </nav>

      <div className={`mo ${wizardOpen ? "show" : ""}`} onClick={() => !saving && setWizardOpen(false)}>
        <div className="mb" onClick={(e) => e.stopPropagation()}>
          <div className="mb-t">{activeProject ? "Project Details" : "Create Project"}</div>
          <form onSubmit={createProject}>
            <div className="field">
              <label>Client Picker</label>
              <select
                className="cf-input"
                value={clientId}
                onChange={(e) => {
                  const value = e.target.value;
                  setClientId(value);
                  const selected = clients.find((cl) => cl.id === value);
                  if (selected) {
                    setClientName(selected.full_name);
                    if (selected.address) setProjectAddress(selected.address);
                  }
                }}
              >
                <option value="">No client selected</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Project Name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Renovation"
                required
              />
            </div>

            <div className="field">
              <label>Address</label>
              <input
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="123 Main St, Toronto ON"
              />
            </div>

            <div className="mb-b">
              <button className="btn bg" type="button" onClick={() => setWizardOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn bp" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Project"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`mo ${roomModalOpen ? "show" : ""}`} onClick={() => !saving && setRoomModalOpen(false)}>
        <div className="mb" onClick={(e) => e.stopPropagation()}>
          <div className="mb-t">Choose Room Type</div>
          <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
            {ROOM_TYPES.map((type, index) => (
              <button
                className="btn bg"
                style={{ justifyContent: "flex-start", width: "100%", marginBottom: 5 }}
                type="button"
                key={type.n}
                onClick={() => addRoom(index)}
                disabled={saving}
              >
                {type.ic} {type.n}
              </button>
            ))}
          </div>
          <div className="mb-b">
            <button className="btn bg" type="button" onClick={() => setRoomModalOpen(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className={`mo ${clientModalOpen ? "show" : ""}`} onClick={() => !saving && setClientModalOpen(false)}>
        <div className="mb" onClick={(e) => e.stopPropagation()}>
          <div className="mb-t">{editingClientId ? "Edit Client" : "New Client"}</div>
          <form onSubmit={saveClient}>
            <div className="cf-field">
              <div className="cf-label">Full Name *</div>
              <input
                className="cf-input"
                type="text"
                value={clientForm.full_name}
                onChange={(e) => setClientForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="cf-field">
              <div className="cf-label">Phone</div>
              <input
                className="cf-input"
                type="tel"
                value={clientForm.phone}
                onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(416) 555-0100"
              />
            </div>
            <div className="cf-field">
              <div className="cf-label">Email</div>
              <input
                className="cf-input"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="jane@example.com"
              />
            </div>
            <div className="cf-field">
              <div className="cf-label">Address</div>
              <input
                className="cf-input"
                type="text"
                value={clientForm.address}
                onChange={(e) => setClientForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St, Toronto ON"
              />
            </div>
            <div className="cf-field">
              <div className="cf-label">Notes</div>
              <textarea
                className="cf-textarea"
                value={clientForm.notes}
                onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Referral source, special notes..."
              />
            </div>
            {clientFormError ? (
              <div className="alert-card warning" style={{ marginBottom: 10 }}>
                <div className="alert-i">⚠️</div>
                <div className="alert-body">
                  <div className="alert-t">Could not save client</div>
                  <div className="alert-s">{clientFormError}</div>
                </div>
              </div>
            ) : null}
            <div className="mb-b">
              <button className="btn bg" type="button" onClick={() => setClientModalOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn bp" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Client"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
