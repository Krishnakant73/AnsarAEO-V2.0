import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tool } from "@openrouter/agent";
import { z } from "zod";

export const listDirTool = tool({
  name: "list_dir",
  description: "List the entries (files and folders) in a directory.",
  inputSchema: z.object({
    path: z.string().default(".").describe("Directory path (defaults to cwd)"),
  }),
  execute: async ({ path }) => {
    try {
      const entries = readdirSync(path).map((name) => {
        let kind = "file";
        try {
          kind = statSync(join(path, name)).isDirectory() ? "dir" : "file";
        } catch {
          /* unreadable entry — report as file */
        }
        return { name, kind };
      });
      return { path, entries };
    } catch (err) {
      return { path, error: err instanceof Error ? err.message : String(err) };
    }
  },
});
