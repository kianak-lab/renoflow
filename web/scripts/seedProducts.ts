/**
 * Seeds public.cached_products from the master material catalog (TB in final-catalog).
 * For each line item, calls your running app at SEED_BASE_URL + /api/homedepot,
 * takes the top 2 results, and inserts rows (requires SUPABASE_SERVICE_ROLE_KEY).
 *
 * Run from repo `web/`:  npm run seed:products
 * Prerequisites:  next dev (or start) on SEED_BASE_URL, SERPAPI_KEY, HOMEDEPOT_INTERNAL_KEY, migration applied.
 */

import { createServiceClient } from "../src/lib/supabase-service";
import { TB, TN, type CatalogItem } from "../src/lib/final-catalog";
import {
  DEFAULT_DELAY_MS as DELAY_MS,
  SEED_BASE_URL,
  fetchTopTwo,
  labelToSearchTerm,
  sleep,
  toCachedProductInserts,
} from "./homedepotSeedShared";

function buildMasterList(): { trade: string; subsection: string; searchTerm: string }[] {
  const out: { trade: string; subsection: string; searchTerm: string }[] = [];
  for (const [tradeId, items] of Object.entries(TB) as [string, CatalogItem[]][]) {
    const trade = TN[tradeId] ?? tradeId;
    for (const it of items) {
      out.push({
        trade,
        subsection: it.l,
        searchTerm: labelToSearchTerm(it.l),
      });
    }
  }
  return out;
}

async function main() {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load web/.env.local or set in shell.",
    );
    process.exit(1);
  }

  const rows = buildMasterList();
  console.log(
    `Seeding from ${rows.length} catalog lines → ${SEED_BASE_URL}/api/homedepot (delay ${DELAY_MS}ms between items)`,
  );

  let done = 0;
  for (const row of rows) {
    const label = `${row.trade} / ${row.subsection}`;
    try {
      const products = await fetchTopTwo(row.searchTerm);
      if (products.length === 0) {
        console.warn(`[${done + 1}/${rows.length}] No results:`, label);
      }
      const inserts = toCachedProductInserts(
        row.trade,
        row.subsection,
        row.searchTerm,
        products,
      );
      if (inserts.length > 0) {
        const { error } = await supabase.from("cached_products").insert(inserts);
        if (error) throw error;
        console.log(
          `[${done + 1}/${rows.length}] OK ${inserts.length} row(s):`,
          label.slice(0, 80),
        );
      }
    } catch (e) {
      console.error(`[${done + 1}/${rows.length}] FAIL:`, label, e);
    }
    done += 1;
    if (done < rows.length) await sleep(DELAY_MS);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
