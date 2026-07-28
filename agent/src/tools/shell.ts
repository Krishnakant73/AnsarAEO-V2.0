import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@openrouter/agent";
import { z } from "zod";

const execAsync = promisify(exec);

// Destructive-command guard is ALSO enforced at the agent level via a
// PreToolUse hook (see agent.ts); this second check is defense-in-depth so
// the tool is safe even if invoked outside that loop.
const DESTRUCTIVE =
  /\brm\s+-rf\b|\bmkfs\b|\bformat\b|:\(\)\s*\{|\bshutdown\b|\breboot\b|\bdel\s+\/|\brmdir\s+\/s|>\s*\/dev\/sd/i;

export const shellTool = tool({
  name: "run_shell",
  description:
    "Run a shell command and return stdout/stderr. Use for read-only/informational commands (ls, git status, cat, npm ls). Destructive commands are refused.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run"),
    cwd: z.string().optional().describe("Working directory"),
  }),
  execute: async ({ command, cwd }) => {
    if (DESTRUCTIVE.test(command)) {
      return { ok: false, refused: true, stderr: "Refused: command looks destructive." };
    }
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 30_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return { ok: true, stdout: stdout.slice(0, 10_000), stderr: stderr.slice(0, 2_000) };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? e.message ?? "error" };
    }
  },
});
