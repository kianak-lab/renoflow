/**
 * Applies pending migrations in supabase/migrations (including 003_cached_products)
 * using direct Postgres. Requires DATABASE_URL or SUPABASE_DB_URL in web/.env.local
 * (Supabase → Project Settings → Database → Connection string → URI; Session or Transaction).
 *
 * Verifies public.cached_products exists via information_schema.
 *
 * Usage (from web/):  npm run db:migrate:cached-products
 */

import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
loadEnvConfig(webRoot);

function clientOptions(url: string): pg.ClientConfig {
  return {
    connectionString: url,
    ssl: url.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
  };
}

function runDbPush(dbUrl: string) {
  const r = spawnSync("npx", ["supabase", "db", "push", "--db-url", dbUrl], {
    cwd: webRoot,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if (r.status !== 0 && r.status != null) {
    process.exit(r.status);
  }
}

async function verifyTable(databaseUrl: string) {
  const client = new pg.Client(clientOptions(databaseUrl));
  await client.connect();
  try {
    const { rows } = await client.query<{
      column_name: string;
      data_type: string;
    }>(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'cached_products'
       order by ordinal_position`,
    );
    if (rows.length === 0) {
      console.error("Verification failed: cached_products has no columns.");
      process.exit(1);
    }
    console.log("cached_products columns:");
    for (const r of rows) {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();
  if (!databaseUrl) {
    console.error(
      "Missing DATABASE_URL or SUPABASE_DB_URL.\n" +
        "Add the Postgres connection string to web/.env.local (see .env.example).\n" +
        "Supabase → Project Settings → Database → Connection string (URI).",
    );
    process.exit(1);
  }

  runDbPush(databaseUrl);
  await verifyTable(databaseUrl);
  console.log("Migration push + verification done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
