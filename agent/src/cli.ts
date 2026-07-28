import * as readline from "node:readline/promises";
import { stdin, stdout, argv } from "node:process";
import { runTurn, activeModel } from "./agent";

// One-shot mode:   npm start -- "your question"   (prints answer, exits)
// Interactive REPL: npm start                     (multi-turn conversation)

async function repl(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  stdout.write(`AnsarAEO agent · model ${activeModel()} · OpenRouter\n`);
  stdout.write("Type a message, or 'exit' to quit.\n\n");
  try {
    for (;;) {
      const line = (await rl.question("\u203a ")).trim();
      if (!line) continue;
      if (line === "exit" || line === "quit") break;
      stdout.write("\n");
      await runTurn(line, { stream: true });
      stdout.write("\n");
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const prompt = argv.slice(2).join(" ").trim();
  if (prompt) {
    await runTurn(prompt, { stream: true });
    return;
  }
  await repl();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
