// Dump the CURRENT live Supabase schema (all tables + columns) from the
// PostgREST OpenAPI spec at {SUPABASE_URL}/rest/v1/. This is the definitive
// ground truth after a DB regeneration. Writes live-schema.json.
//
//   node scripts/dump-schema.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function env(key) {
  const raw = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] === key) return m[2].trim();
  }
  return undefined;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");

async function main() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
  });
  if (!res.ok) {
    console.error("Failed to fetch schema:", res.status, await res.text());
    process.exit(1);
  }
  const spec = await res.json();
  const defs = spec.definitions ?? {};
  const schema = {};
  for (const [table, def] of Object.entries(defs)) {
    const cols = Object.keys(def.properties ?? {});
    // required[] lists NOT NULL columns without defaults (PostgREST convention
    // is to mark columns without defaults as required in the request body).
    schema[table] = { columns: cols, required: def.required ?? [] };
  }
  writeFileSync(join(root, "live-schema.json"), JSON.stringify(schema, null, 2));
  console.log(`TABLES=${Object.keys(schema).length}`);
  console.log("DUMP_DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
