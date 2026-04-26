import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function sanitizeIlikePattern(raw: string): string {
  const t = raw
    .trim()
    .slice(0, 120)
    .replace(/[%_\\,'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

const SELECT_COLS =
  "id,thumbnail,brand,title,price,trade,subsection,search_term,model_number,sku";

type CachedRow = {
  id: string;
  thumbnail: string | null;
  brand: string | null;
  title: string | null;
  price: string | null;
  trade: string | null;
  subsection: string | null;
  search_term: string | null;
  model_number: string | null;
  sku: string | null;
};

/**
 * Search cached_products only (no SerpAPI). Used by the materials list UI.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "Missing q query parameter." },
      { status: 400 },
    );
  }

  const pattern = sanitizeIlikePattern(q);
  if (!pattern) {
    return NextResponse.json({ products: [] });
  }

  const like = `%${pattern}%`;

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side product access." },
      { status: 500 },
    );
  }

  const [byTitle, byTerm] = await Promise.all([
    supabase
      .from("cached_products")
      .select(SELECT_COLS)
      .ilike("title", like)
      .order("trade", { ascending: true })
      .order("title", { ascending: true })
      .limit(40),
    supabase
      .from("cached_products")
      .select(SELECT_COLS)
      .ilike("search_term", like)
      .order("trade", { ascending: true })
      .order("title", { ascending: true })
      .limit(40),
  ]);

  if (byTitle.error) {
    return NextResponse.json({ error: byTitle.error.message }, { status: 500 });
  }
  if (byTerm.error) {
    return NextResponse.json({ error: byTerm.error.message }, { status: 500 });
  }

  const map = new Map<string, CachedRow>();
  for (const r of [...(byTitle.data ?? []), ...(byTerm.data ?? [])]) {
    const row = r as CachedRow;
    if (row.id) map.set(row.id, row);
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const ta = (a.trade ?? "").localeCompare(b.trade ?? "");
    if (ta !== 0) return ta;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return NextResponse.json({ products: merged.slice(0, 40) });
}
