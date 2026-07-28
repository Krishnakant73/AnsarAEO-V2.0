// Layered config: process.env → agent/.env → ../.env.local (the AnsarAEO
// app's env, so the agent runs out-of-the-box inside this repo without
// duplicating the secret). First value wins.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = join(here, "..");
const repoRoot = join(agentRoot, "..");

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const fileEnv = {
  ...parseEnvFile(join(repoRoot, ".env.local")),
  ...parseEnvFile(join(agentRoot, ".env")),
};

function get(key: string): string | undefined {
  return process.env[key] ?? fileEnv[key];
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxSteps: number;
}

export function loadConfig(): AgentConfig {
  const apiKey = get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY not found. Copy .env.example to .env and add your key (or set it in the environment).",
    );
  }
  return {
    apiKey,
    model: get("AGENT_MODEL") ?? "openai/gpt-4o-mini",
    maxSteps: Number(get("AGENT_MAX_STEPS") ?? "12"),
  };
}
