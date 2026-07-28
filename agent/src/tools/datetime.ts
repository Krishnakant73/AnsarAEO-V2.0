import { tool } from "@openrouter/agent";
import { z } from "zod";

export const datetimeTool = tool({
  name: "get_datetime",
  description: "Get the current date and time (ISO 8601 UTC + local string).",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      local: now.toString(),
      unixMs: now.getTime(),
    };
  },
});
