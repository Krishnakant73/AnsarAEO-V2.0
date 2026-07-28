import { OpenRouter } from "@openrouter/sdk";
import {
  callModel,
  stepCountIs,
  type ConversationState,
  type StateAccessor,
} from "@openrouter/agent";
import { loadConfig } from "./config";
import { tools } from "./tools/index";

const config = loadConfig();

const client = new OpenRouter({
  apiKey: config.apiKey,
  // Optional attribution for openrouter.ai rankings.
  httpReferer: "https://ansaraeo.com",
  appTitle: "AnsarAEO Agent",
});

const SYSTEM = [
  "You are the AnsarAEO terminal agent, running inside the AnsarAEO codebase.",
  "You have tools to read files, list directories, run read-only shell commands, and get the current time.",
  "Prefer using tools to ground your answers in the real repository instead of guessing.",
  "Be concise. When you run tools, briefly explain what you found.",
].join(" ");

// In-memory conversation state so multi-turn REPL sessions keep context.
// Swap this StateAccessor for a file/SQLite/Redis-backed one to persist.
let stored: ConversationState | null = null;
const state: StateAccessor = {
  load: async () => stored,
  save: async (s) => {
    stored = s;
  },
};

export interface RunOptions {
  /** Stream text deltas to stdout as they arrive. */
  stream?: boolean;
}

export async function runTurn(input: string, opts: RunOptions = {}): Promise<string> {
  const result = callModel(client, {
    model: config.model,
    instructions: SYSTEM,
    input,
    tools,
    state,
    // Stop after N tool-execution steps; the loop then makes a final
    // natural-language turn automatically (allowFinalResponse defaults on).
    stopWhen: stepCountIs(config.maxSteps),
    // Defense-in-depth: block obviously destructive shell commands before
    // they execute, independent of the tool's own guard.
    hooks: {
      PreToolUse: [
        {
          matcher: "run_shell",
          handler: ({ toolInput }) => {
            const command = String((toolInput as { command?: unknown }).command ?? "");
            if (/\brm\s+-rf\b|\bmkfs\b|\bformat\b|\bshutdown\b|\breboot\b/i.test(command)) {
              return { block: "Refusing to run a destructive command." };
            }
            return undefined;
          },
        },
      ],
    },
  });

  if (opts.stream) {
    let acc = "";
    for await (const delta of result.getTextStream()) {
      acc += delta;
      process.stdout.write(delta);
    }
    process.stdout.write("\n");
    return acc;
  }

  return result.getText();
}

export function activeModel(): string {
  return config.model;
}
