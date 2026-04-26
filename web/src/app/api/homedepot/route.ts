import { NextRequest, NextResponse } from "next/server";
import { fetchHomeDepotSerpProducts } from "@/lib/home-depot-serpapi";

export const dynamic = "force-dynamic";

/**
 * SerpAPI proxy for **offline seed scripts only** (npm run seed:products / pass2).
 * Requires `Authorization: Bearer <HOMEDEPOT_INTERNAL_KEY>`.
 * The browser and normal UI must not call this route — use cached_products + POST refresh-from-supplier.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.HOMEDEPOT_INTERNAL_KEY?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "HOMEDEPOT_INTERNAL_KEY is not configured." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const token =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q");
  const products = await fetchHomeDepotSerpProducts(q ?? "");
  return NextResponse.json(products);
}
