import { NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { fetchRoomsForFinalApp } from "@/lib/project-workspace-rooms";
import { nextInvoiceSequenceForUser } from "@/lib/project-sequences";

export const dynamic = "force-dynamic";

function str(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return fallback;
}

function num(row: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

function bool(row: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "boolean") return v;
  }
  return false;
}

/** Maps a Supabase `invoices` row to the shape used by `final.html`. */
function mapInvoiceRow(row: Record<string, unknown>) {
  const subtotal = num(row, ["subtotal", "subtotal_amount"], 0);
  const taxRate = num(row, ["tax_rate", "taxRate"], 0);
  const tax = num(row, ["tax_amount", "tax", "taxAmount"], 0);
  const total = num(row, ["total_amount", "total", "totalAmount"], subtotal + tax);
  return {
    id: str(row, ["id"]),
    num: str(row, ["invoice_number", "num", "invoiceNumber"], "INV-000"),
    clientName: str(row, ["client_name", "clientName"]),
    clientEmail: str(row, ["client_email", "clientEmail"]),
    clientPhone: str(row, ["client_phone", "clientPhone"]),
    clientAddr: str(row, ["client_address", "clientAddr", "client_address_line"]),
    projName: str(row, ["project_name", "projName"]),
    terms: str(row, ["terms_code", "terms"], "net7"),
    createdDate: str(row, ["created_date", "createdDate"], ""),
    sentDate: row.sent_date ? str(row, ["sent_date", "sentDate"]) : null,
    paid: bool(row, ["paid"]),
    void: bool(row, ["void"]),
    deposit: num(row, ["deposit_amount", "deposit"], 0),
    depositPaid: bool(row, ["deposit_paid", "depositPaid"]),
    subtotal,
    taxRate,
    tax,
    total,
    rooms: (() => {
      const rs = row.room_snapshot;
      if (Array.isArray(rs)) return rs;
      if (typeof rs === "string") {
        try {
          const p = JSON.parse(rs) as unknown;
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      }
      return [];
    })(),
    notes: str(row, ["notes"]),
    coName: str(row, ["company_name", "coName"]),
    coPhone: str(row, ["company_phone", "coPhone"]),
    coEmail: str(row, ["company_email", "coEmail"]),
    coAddr: str(row, ["company_address", "coAddr"]),
    coLic: str(row, ["company_license", "coLic"]),
  };
}

function projectPatch(row: Record<string, unknown>) {
  const includeTimeline =
    row.include_timeline === false || row.include_timeline === null ? false : true;
  const calRec = row.calendar_recipients;
  return {
    dbProjectId: str(row, ["id"]),
    name: str(row, ["name"], "My Renovation"),
    client: str(row, ["client_name", "client"], ""),
    addr: str(row, ["address", "addr"], ""),
    qnum: str(row, ["quote_number", "qnum"], "Q-001"),
    notes: str(row, ["notes"], ""),
    startDate: str(row, ["start_date", "startDate"], ""),
    deadlineDate: str(row, ["deadline_date", "deadlineDate"], ""),
    parallelRooms: bool(row, ["parallel_rooms", "parallelRooms"]),
    includeTimeline,
    clientId: str(row, ["client_id", "clientId"], ""),
    calendarSlug: str(row, ["calendar_slug", "calendarSlug"], ""),
    calendarRecipients: Array.isArray(calRec) ? calRec : [],
    calendarMyGoogleEnabled: bool(row, ["calendar_my_google_enabled", "calendarMyGoogleEnabled"]),
  };
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteCtx) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side project access." },
      { status: 500 },
    );
  }

  const { id: projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  }

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", auth.uid)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proj) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const projRow = proj as Record<string, unknown>;

  const { data: invRows, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  let quoteRows: Record<string, unknown>[] = [];
  const quotesRes = await supabase
    .from("quotes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (!quotesRes.error) quoteRows = (quotesRes.data ?? []) as Record<string, unknown>[];
  else console.warn("[workspace] quotes:", quotesRes.error.message);

  let rooms: Array<Record<string, unknown>> = [];
  try {
    rooms = (await fetchRoomsForFinalApp(supabase, projectId)) as Array<Record<string, unknown>>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workspace] rooms fetch:", msg);
    rooms = [];
  }

  const invoices = ((invRows ?? []) as Record<string, unknown>[]).map(mapInvoiceRow);
  const quotes = quoteRows;

  const invNumSuggested = await nextInvoiceSequenceForUser(supabase, auth.uid);

  return NextResponse.json({
    project: projectPatch(projRow),
    rooms,
    invoices,
    quotes,
    invNumSuggested,
  });
}
