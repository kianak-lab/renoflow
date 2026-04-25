import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUidFromSession } from "@/lib/api-session";
import { createServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSupabaseUidFromSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const trade = request.nextUrl.searchParams.get("trade")?.trim() ?? "";
  if (!trade) {
    return NextResponse.json(
      { error: "Missing trade query parameter (human trade label, e.g. Demolition)." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY for server-side product access." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("cached_products")
    .select("id,thumbnail,brand,title,price,trade")
    .eq("trade", trade)
    .order("title", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}
