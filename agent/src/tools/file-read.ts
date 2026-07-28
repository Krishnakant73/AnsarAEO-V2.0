import { readFileSync } from "node:fs";
import { tool } from "@openrouter/agent";
import { z } from "zod";

export const readFileTool = tool({
  name: "read_file",
  description: "Read a UTF-8 text file. Optionally restrict to a 1-indexed line range.",
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative file path"),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  }),
  execute: async ({ path, startLine, endLine }) => {
    try {
      const content = readFileSync(path, "utf8");
      if (startLine === undefined && endLine === undefined) {
        return { path, content: content.slice(0, 20_000) };
      }
      const lines = content.split(/\r?\n/);
      const slice = lines.slice((startLine ?? 1) - 1, endLine ?? lines.length);
      return { path, content: slice.join("\n").slice(0, 20_000) };
    } catch (err) {
      return { path, error: err instanceof Error ? err.message : String(err) };
    }
  },
});
