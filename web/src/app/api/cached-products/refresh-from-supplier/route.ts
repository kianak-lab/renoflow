import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";
import { serpProductToCachedColumns } from "@/lib/cached-product-from-serp";
import { fetchHomeDepotSerpProducts } from "@/lib/home-depot-serpapi";

export const dynamic = "force-dynamic";

const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Explicit contractor action: re-fetch Home Depot via SerpAPI for each distinct
 * search_term under a trade, then update cached_products rows (same ordering as seed).
 */
export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { trade?: string };
  try {
    body = (await request.json()) as { trade?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const trade = body.trade?.trim() ?? "";
  if (!trade) {
    return NextResponse.json(
      { error: "Missing trade (human label, e.g. Plumbing)." },
      { status: 400 },
    );
  }

  if (!process.env.SERPAPI_KEY?.trim()) {
    return NextResponse.json(
      { error: "SERPAPI_KEY is not configured." },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const { data: rows, error: selErr } = await supabase
    .from("cached_products")
    .select("id,search_term")
    .eq("trade", trade)
    .order("search_term", { ascending: true })
    .order("id", { ascending: true });

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const list = rows ?? [];
  if (list.length === 0) {
    return NextResponse.json({
      updated: 0,
      searchTerms: 0,
      trade,
      message: "No cached rows for this trade.",
    });
  }

  const byTerm = new Map<string, { id: string }[]>();
  for (const r of list) {
    const term = String(r.search_term ?? "").trim();
    if (!term) continue;
    const id = String(r.id ?? "");
    if (!id) continue;
    if (!byTerm.has(term)) byTerm.set(term, []);
    byTerm.get(term)!.push({ id });
  }

  let updated = 0;
  const terms = Array.from(byTerm.keys()).sort((a, b) => a.localeCompare(b));

  for (let ti = 0; ti < terms.length; ti++) {
    const term = terms[ti]!;
    const group = byTerm.get(term)!;
    const products = await fetchHomeDepotSerpProducts(term);
    const fetchedAt = new Date().toISOString();
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < sorted.length; i++) {
      const serp = products[i];
      if (!serp) break;
      const cols = serpProductToCachedColumns(serp, fetchedAt);
      const { error: upErr } = await supabase
        .from("cached_products")
        .update(cols)
        .eq("id", sorted[i]!.id);
      if (!upErr) updated += 1;
    }

    if (ti < terms.length - 1) await sleep(DELAY_MS);
  }

  return NextResponse.json({
    updated,
    searchTerms: terms.length,
    trade,
  });
}
