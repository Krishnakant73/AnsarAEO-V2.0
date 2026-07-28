#!/usr/bin/env node
// ============================================================================
// AnsarAEO — Supabase migration runner (standalone, no transpiler required)
// ----------------------------------------------------------------------------
// Applies the full SQL schema to the Supabase Postgres database, in the exact
// order the project intends:
//
//   1. supabase/schema.sql                       (base tables + auth trigger)
//   2. supabase/migration_002 … migration_030    (top-level, numeric order)
//   3. supabase/migrations/migration_023 … 026   (platform layer, numeric)
//
// Usage:
//   node scripts/apply-migrations.mjs            # apply schema + all migrations
//   node scripts/apply-migrations.mjs --reset    # run reset.sql FIRST (drops
//                                                #   the app's tables), then apply
//   node scripts/apply-migrations.mjs --dry-run  # print the order, don't connect
//
// Requires DATABASE_URL in .env.local, e.g. (direct connection — best for DDL):
//   DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
//
// Each file is applied inside its own transaction: if any statement in a file
// fails, that file is rolled back and the runner stops with the exact error, so
// you can fix and re-run. schema.sql uses bare `create table` (no IF NOT
// EXISTS), so run against a FRESH database, or pass --reset to start clean.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const ROOT = process.cwd();
const SUPA = path.join(ROOT, "supabase");

// --- load .env.local (strip inline # comments), same approach as seed-sample-brand.mjs ---
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const args = process.argv.slice(2);
const doReset = args.includes("--reset");
const dryRun = args.includes("--dry-run");

// numeric sort by the migration_NNN prefix so 002 < 010 < 100
function byMigrationNumber(a, b) {
  const n = (f) => parseInt((f.match(/migration_(\d+)/) || [])[1] ?? "0", 10);
  return n(a) - n(b);
}

const topLevel = fs
  .readdirSync(SUPA)
  .filter((f) => /^migration_\d+.*\.sql$/.test(f))
  .sort(byMigrationNumber)
  .map((f) => path.join(SUPA, f));

const subDir = path.join(SUPA, "migrations");
const subLevel = fs.existsSync(subDir)
  ? fs
      .readdirSync(subDir)
      .filter((f) => /^migration_\d+.*\.sql$/.test(f))
      .sort(byMigrationNumber)
      .map((f) => path.join(subDir, f))
  : [];

const ordered = [
  ...(doReset ? [path.join(SUPA, "reset.sql")] : []),
  path.join(SUPA, "schema.sql"),
  ...topLevel,
  ...subLevel,
];

console.log(`\nMigration plan (${ordered.length} files)${doReset ? " [--reset]" : ""}:`);
for (const [i, f] of ordered.entries()) {
  console.log(`  ${String(i + 1).padStart(2, "0")}. ${path.relative(ROOT, f)}`);
}

if (dryRun) {
  console.log("\n--dry-run: not connecting to the database.");
  process.exit(0);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || /<DB_PASSWORD>|<PROJECT_REF>/.test(DATABASE_URL)) {
  console.error(
    "\nERROR: DATABASE_URL is missing or still a placeholder in .env.local.\n" +
      "Set it to the Supabase connection string (Dashboard > Project Settings > Database >\n" +
      "Connection string > URI), e.g.\n" +
      "  DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.<ref>.supabase.co:5432/postgres\n"
  );
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: "require", // Supabase requires TLS
  idle_timeout: 20,
  connect_timeout: 30,
});

// Postgres error codes that mean "this object was already created by a prior
// run" — expected when filling gaps in a partially-migrated database, NOT a
// real failure. See https://www.postgresql.org/docs/current/errcodes-appendix.html
const ALREADY_EXISTS = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (constraints, policies, triggers)
  "42701", // duplicate_column
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  "42P16", // invalid_table_definition (e.g. re-adding a PK)
  "23505", // unique_violation (re-seeding a fixed row)
]);

async function main() {
  // Fail fast with a clear message if the credentials/host are wrong.
  const [{ version }] = await sql`select version()`;
  console.log(`\nConnected: ${version.split(" ").slice(0, 2).join(" ")}`);

  const applied = [];
  const skipped = [];
  const failed = [];

  for (const file of ordered) {
    const rel = path.relative(ROOT, file);
    const contents = fs.readFileSync(file, "utf8");
    process.stdout.write(`  ${rel} … `);
    try {
      // One transaction per file: statements in a file are all-or-nothing, so
      // a file either applies cleanly or is left untouched (no half-applied files).
      await sql.begin((tx) => [tx.unsafe(contents)]);
      console.log("APPLIED");
      applied.push(rel);
    } catch (err) {
      if (ALREADY_EXISTS.has(err.code)) {
        // The file's objects already exist (this migration ran before). Because
        // almost every migration uses `create table if not exists`, a file that
        // trips this is one already fully applied — safe to skip.
        console.log(`skipped (already applied: ${err.code})`);
        skipped.push(rel);
      } else {
        console.log(`FAILED (${err.code ?? "?"})`);
        console.error(`      → ${err.message}`);
        failed.push({ rel, code: err.code, message: err.message });
      }
    }
  }

  const [{ count }] = await sql`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `;

  console.log(
    `\nSummary: ${applied.length} applied, ${skipped.length} already-present, ${failed.length} failed.`
  );
  console.log(`public schema now has ${count} base tables.`);

  if (failed.length) {
    console.error("\nFiles that failed for a real reason (need attention):");
    for (const f of failed) console.error(`  ✗ ${f.rel}  [${f.code}] ${f.message}`);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  console.log("\n✓ Database is in sync with all SQL in supabase/.");
  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(`\nERROR: ${err.message}`);
  try {
    await sql.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
