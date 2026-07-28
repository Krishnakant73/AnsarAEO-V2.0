// Verify the Sentry wiring end-to-end:
//   1. Auth token (sntryu_...) can reach the Sentry API.
//   2. The DSN ingest endpoint accepts a test event.
//
//   node scripts/test-sentry.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function env(k) {
  const raw = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] === k) return m[2].trim();
  }
  return undefined;
}

const dsn = env("SENTRY_DSN");
const token = env("SENTRY_AUTH_TOKEN");
const org = env("SENTRY_ORG");

// Parse DSN: https://<publicKey>@<host>/<projectId>
const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn ?? "");
const out = [];

// 1. Auth token -> list org projects.
try {
  const res = await fetch(`https://sentry.io/api/0/organizations/${org}/projects/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  let names = "";
  try {
    names = JSON.parse(body).map((p) => p.slug).join(", ");
  } catch { /* non-json */ }
  out.push(`AUTH_TOKEN: ${res.ok ? `OK (${res.status}) projects: ${names || "(none)"}` : `FAIL ${res.status} ${body.slice(0, 120)}`}`);
} catch (e) {
  out.push(`AUTH_TOKEN: ERROR ${String(e)}`);
}

// 2. DSN ingest -> send a test event via the store endpoint.
if (m) {
  const [, publicKey, host, projectId] = m;
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "info",
    logger: "aeo.wiring-test",
    message: { formatted: "AEO Sentry wiring test — safe to ignore" },
    tags: { source: "test-sentry.mjs" },
  };
  try {
    const res = await fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=aeo-test/1.0`,
      },
      body: JSON.stringify(event),
    });
    const body = await res.text();
    out.push(`DSN_INGEST: ${res.ok ? `OK (${res.status}) id=${body.slice(0, 80)}` : `FAIL ${res.status} ${body.slice(0, 160)}`}`);
  } catch (e) {
    out.push(`DSN_INGEST: ERROR ${String(e)}`);
  }
} else {
  out.push(`DSN_INGEST: SKIP — DSN did not parse`);
}

console.log(out.join("\n"));
console.log("SENTRY_TEST_DONE");
