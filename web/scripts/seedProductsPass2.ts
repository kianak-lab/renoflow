/**
 * Second seed pass: bulk trade/subsection search terms → cached_products.
 * Skips when any row already exists with the same search_term.
 *
 * Run from web/:  npm run seed:products:pass2
 * Requires: next dev on SEED_BASE_URL, SERPAPI_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createServiceClient } from "../src/lib/supabase-service";
import {
  DEFAULT_DELAY_MS,
  SEED_BASE_URL,
  fetchTopTwo,
  sleep,
  toCachedProductInserts,
} from "./homedepotSeedShared";

type SeedRow = { trade: string; subsection: string; searchTerm: string };

const PASS2_ROWS: SeedRow[] = [
  // BULKHEAD
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "steel stud 2-1/2 inch 25 gauge" },
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "steel track 2-1/2 inch 25 gauge" },
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "resilient channel" },
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "drywall screw fine thread" },
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "construction adhesive" },
  { trade: "Bulkhead", subsection: "Materials", searchTerm: "corner bead metal 90 degree" },
  // PLUMBING — DRAIN & WASTE
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS pipe 3 inch 10ft" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS pipe 4 inch 10ft" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS pipe 1-1/2 inch 10ft" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS pipe 2 inch 10ft" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS P-trap 1-1/2 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS P-trap 2 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS elbow 90 degree 3 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS elbow 45 degree 3 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS tee 3 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS cleanout 4 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "closet flange 4x3 inch" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "wax ring toilet" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS cement" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "ABS primer" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "shower drain square" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "drain assembly bathroom sink" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "pop up drain assembly" },
  { trade: "Plumbing", subsection: "Drain & Waste", searchTerm: "tub drain kit" },
  // PLUMBING — WATER LINES
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "PEX pipe 1/2 inch 100ft" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "PEX pipe 3/4 inch 100ft" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "PEX elbow 1/2 inch" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "PEX coupling 1/2 inch" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "PEX tee 1/2 inch" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "SharkBite fitting 1/2 push connect" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "SharkBite elbow 1/2 push connect" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "ball valve 1/2 inch" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "ball valve 3/4 inch" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "shut off valve angle 1/2" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "pressure relief valve" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "supply line toilet braided" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "supply line faucet braided" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "thread seal tape teflon" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "pipe insulation foam" },
  { trade: "Plumbing", subsection: "Water Lines", searchTerm: "copper pipe 1/2 inch 10ft" },
  // PLUMBING — FIXTURES
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "toilet elongated 2 piece" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "toilet round compact" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "bathroom faucet single hole" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "bathroom faucet widespread" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "kitchen faucet pull down" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "shower valve pressure balanced" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "shower head" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "rain shower head" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "hand shower kit" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "tub faucet spout" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "water heater 40 gallon electric" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "water heater 50 gallon electric" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "tankless water heater" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "sump pump submersible" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "undermount kitchen sink" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "drop in bathroom sink" },
  { trade: "Plumbing", subsection: "Fixtures", searchTerm: "vessel sink" },
  // TAPING
  { trade: "Taping", subsection: "Materials", searchTerm: "joint compound all purpose 17L" },
  { trade: "Taping", subsection: "Materials", searchTerm: "setting compound Durabond 45" },
  { trade: "Taping", subsection: "Materials", searchTerm: "setting compound Durabond 90" },
  { trade: "Taping", subsection: "Materials", searchTerm: "paper tape drywall" },
  { trade: "Taping", subsection: "Materials", searchTerm: "mesh tape fiberglass self adhesive" },
  { trade: "Taping", subsection: "Materials", searchTerm: "corner bead metal 90 degree" },
  { trade: "Taping", subsection: "Materials", searchTerm: "corner bead bullnose" },
  { trade: "Taping", subsection: "Materials", searchTerm: "flexible corner bead vinyl" },
  { trade: "Taping", subsection: "Materials", searchTerm: "drywall knife 6 inch" },
  { trade: "Taping", subsection: "Materials", searchTerm: "drywall knife 10 inch" },
  { trade: "Taping", subsection: "Materials", searchTerm: "drywall knife 12 inch" },
  { trade: "Taping", subsection: "Materials", searchTerm: "mud pan stainless" },
  { trade: "Taping", subsection: "Materials", searchTerm: "pole sander drywall" },
  { trade: "Taping", subsection: "Materials", searchTerm: "sanding screen 120 grit" },
  { trade: "Taping", subsection: "Materials", searchTerm: "drywall primer sealer" },
  // ELECTRICAL — ROUGH-IN
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "NMD90 wire 14/2 75ft" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "NMD90 wire 12/2 75ft" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "NMD90 wire 14/3 75ft" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "NMD90 wire 12/3 75ft" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "electrical panel 200 amp" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "breaker 15 amp single pole" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "breaker 20 amp single pole" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "breaker 30 amp double pole" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "electrical box single gang" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "electrical box double gang" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "electrical box 4 inch octagon" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "wire connector twist cap" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "wire staple cable" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "conduit EMT 3/4 inch" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "ground wire 6 AWG" },
  { trade: "Electrical", subsection: "Rough-In", searchTerm: "ground rod copper" },
  // ELECTRICAL — DEVICES
  { trade: "Electrical", subsection: "Devices", searchTerm: "GFCI outlet 15 amp" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "GFCI outlet 20 amp" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "AFCI outlet" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "duplex outlet 15 amp" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "single pole switch" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "3-way switch" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "dimmer switch" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "USB outlet" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "outlet cover plate" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "switch plate cover" },
  { trade: "Electrical", subsection: "Devices", searchTerm: "tamper resistant outlet" },
  // ELECTRICAL — FIXTURES & LIGHTING
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "LED pot light 4 inch" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "LED pot light 6 inch" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "smoke detector hardwired" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "CO detector" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "bathroom exhaust fan" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "bathroom exhaust fan with light" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "ceiling fan" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "EV charger level 2" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "under cabinet light LED" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "exterior light fixture" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "motion sensor light" },
  { trade: "Electrical", subsection: "Fixtures & Lighting", searchTerm: "surge protector whole house" },
  // LANDSCAPING
  { trade: "Landscaping", subsection: "Materials", searchTerm: "mulch cedar 2 cubic ft" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "topsoil 25kg" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "grass seed sun shade" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "sod roll" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "landscape fabric weed barrier" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "landscape edging aluminum" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "patio stone 16x16" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "gravel drainage stone" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "river rock decorative" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "garden hose 50ft" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "irrigation drip kit" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "retaining wall block" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "concrete paver 12x12" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "stepping stone" },
  { trade: "Landscaping", subsection: "Materials", searchTerm: "low voltage landscape light kit" },
  // CLEANING
  { trade: "Cleaning", subsection: "Materials", searchTerm: "construction cleaning bags heavy duty" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "HEPA vacuum commercial" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "microfiber mop" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "floor cleaner" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "TSP cleaner" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "concrete cleaner" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "grout cleaner" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "glass cleaner" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "adhesive remover" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "scrub brush" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "squeegee" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "broom industrial" },
  { trade: "Cleaning", subsection: "Materials", searchTerm: "pressure washer" },
  // DECK / FENCE / SHEDS — Decking
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "deck boards composite Trex" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "deck boards pressure treated 5/4x6" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "pressure treated post 4x4 10ft" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "pressure treated joist 2x8" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "post base concrete anchor" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "joist hanger 2x8 galvanized" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "deck screw composite" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "concrete tube form 10 inch" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "concrete mix 30kg" },
  { trade: "Deck Fence Sheds", subsection: "Decking", searchTerm: "deck stain semi-transparent" },
  // Fencing
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "fence board cedar 6ft" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "fence post cedar 4x4" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "fence rail 2x4 cedar" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "fence post cap" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "gate hinge heavy duty" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "gate latch" },
  { trade: "Deck Fence Sheds", subsection: "Fencing", searchTerm: "fence stain and sealer" },
  // Railing
  { trade: "Deck Fence Sheds", subsection: "Railing", searchTerm: "deck railing post aluminum" },
  { trade: "Deck Fence Sheds", subsection: "Railing", searchTerm: "deck railing baluster" },
  { trade: "Deck Fence Sheds", subsection: "Railing", searchTerm: "deck railing top rail" },
];

async function searchTermExists(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  searchTerm: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cached_products")
    .select("id")
    .eq("search_term", searchTerm)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function main() {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load web/.env.local or set in shell.",
    );
    process.exit(1);
  }

  const total = PASS2_ROWS.length;
  console.log(
    `Pass-2 seed: ${total} items → ${SEED_BASE_URL}/api/homedepot (${DEFAULT_DELAY_MS}ms between calls). Skip if search_term exists.`,
  );

  let insertedTotal = 0;
  let skipped = 0;
  let failures = 0;
  let noResults = 0;

  for (let i = 0; i < PASS2_ROWS.length; i++) {
    const row = PASS2_ROWS[i]!;
    const n = i + 1;
    const label = `${row.trade} / ${row.subsection} — ${row.searchTerm}`;

    try {
      if (await searchTermExists(supabase, row.searchTerm)) {
        skipped += 1;
        console.log(`[${n}/${total}] SKIP (exists): ${label}`);
        if (n < total) await sleep(DEFAULT_DELAY_MS);
        continue;
      }

      const products = await fetchTopTwo(row.searchTerm);
      if (products.length === 0) {
        noResults += 1;
        console.warn(`[${n}/${total}] NO RESULTS: ${label}`);
        if (n < total) await sleep(DEFAULT_DELAY_MS);
        continue;
      }

      const inserts = toCachedProductInserts(
        row.trade,
        row.subsection,
        row.searchTerm,
        products,
      );
      const { error } = await supabase.from("cached_products").insert(inserts);
      if (error) throw error;
      insertedTotal += inserts.length;
      console.log(`[${n}/${total}] OK +${inserts.length} row(s): ${label}`);
    } catch (e) {
      failures += 1;
      console.error(`[${n}/${total}] FAIL: ${label}`, e);
    }

    if (n < total) await sleep(DEFAULT_DELAY_MS);
  }

  console.log("—".repeat(60));
  console.log(
    `Complete. Rows inserted: ${insertedTotal}. Skipped (existing search_term): ${skipped}. No API results: ${noResults}. Failures: ${failures}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
