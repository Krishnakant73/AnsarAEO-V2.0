import { datetimeTool } from "./datetime";
import { readFileTool } from "./file-read";
import { listDirTool } from "./list-dir";
import { shellTool } from "./shell";

// `as const` preserves the tuple type so @openrouter/agent can infer each
// tool's input/output schema at the call site.
export const tools = [datetimeTool, readFileTool, listDirTool, shellTool] as const;
