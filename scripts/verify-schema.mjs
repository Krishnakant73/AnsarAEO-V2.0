// Verify flagged (table, column) pairs against the REAL Supabase DB via the
// PostgREST API. A column that doesn't exist makes PostgREST return 400 with
// "column ... does not exist"; an existing column returns 200. This is the
// ground truth (schema.sql may be stale).
//
//   node scripts/verify-schema.mjs

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

const checks = {
  brands: ["slug", "domain", "name"],
  visibility_runs: ["brand_id", "created_at", "run_at", "prompt_id"],
  prompts: ["question", "text", "brand_id"],
  geo_alert_firings: ["window", "window_type", "metric"],
  share_view_tokens: ["workspace_kind", "workspace_id", "brand_id"],
  org_members: ["created_at", "role", "user_id"],
  competitors: ["created_at", "confirmed", "source", "name", "domain"],
};

async function colExists(table, column) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.ok) return { exists: true, status: res.status };
  const body = await res.text();
  // 42703 = undefined_column
  const missing = /does not exist|42703/i.test(body);
  return { exists: !missing, status: res.status, note: body.slice(0, 160) };
}

async function main() {
  const out = { url: url?.replace(/https:\/\//, ""), tables: {} };
  for (const [table, cols] of Object.entries(checks)) {
    out.tables[table] = {};
    for (const col of cols) {
      try {
        out.tables[table][col] = await colExists(table, col);
      } catch (e) {
        out.tables[table][col] = { exists: null, error: String(e) };
      }
    }
  }
  writeFileSync(join(root, "schema-verify-result.json"), JSON.stringify(out, null, 2));
  // Compact console summary
  for (const [table, cols] of Object.entries(out.tables)) {
    for (const [col, r] of Object.entries(cols)) {
      if (r.exists === false) console.log(`MISSING  ${table}.${col}  (status ${r.status})`);
    }
  }
  console.log("VERIFY_DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
