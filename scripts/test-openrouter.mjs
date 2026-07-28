// Standalone OpenRouter connectivity test.
//
//   node scripts/test-openrouter.mjs
//
// Reads OPENROUTER_API_KEY + model IDs from .env.local (no framework boot),
// makes a real chat-completion call against the OpenRouter endpoint the app
// uses (adapters/llm/openrouter-adapter.ts), and writes the outcome to
// openrouter-test-result.json so it can be inspected reliably.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const raw = readFileSync(join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
  }
  return env;
}

async function callModel(apiKey, model, prompt) {
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://ansaraeo.com",
      "X-Title": "AnsarAEO",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave raw */
  }
  return {
    model,
    ok: res.ok,
    status: res.status,
    latencyMs: Date.now() - started,
    content: json?.choices?.[0]?.message?.content ?? null,
    usage: json?.usage ?? null,
    error: res.ok ? null : json?.error ?? text.slice(0, 500),
  };
}

async function main() {
  const env = loadEnv();
  const apiKey = env.OPENROUTER_API_KEY;
  const out = { keyPresent: !!apiKey, keyPrefix: apiKey ? apiKey.slice(0, 12) + "..." : null, results: [] };

  if (!apiKey) {
    writeFileSync(join(root, "openrouter-test-result.json"), JSON.stringify(out, null, 2));
    console.log("NO_KEY");
    return;
  }

  // Test the two models the internal ModelRouter relies on most:
  // OPENROUTER_MODEL (answer-engine default) and DEFAULT_MODEL (capability).
  const models = [
    env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    env.DEFAULT_MODEL || "openai/gpt-4.1-mini",
  ];
  const uniqueModels = [...new Set(models)];

  for (const model of uniqueModels) {
    try {
      out.results.push(await callModel(apiKey, model, "Reply with exactly: OpenRouter is working."));
    } catch (err) {
      out.results.push({ model, ok: false, status: 0, error: String(err) });
    }
  }

  writeFileSync(join(root, "openrouter-test-result.json"), JSON.stringify(out, null, 2));
  console.log(out.results.every((r) => r.ok) ? "ALL_OK" : "SOME_FAILED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
