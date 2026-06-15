import * as dotenv from "dotenv";
dotenv.config();

import { fetchPr } from "../tools/fetch-pr";
import { fetchPrSchema } from "../tools/fetch-pr.schema";
import type { FetchPrInput } from "../tools/fetch-pr.schema";

// Registry: maps tool name → { schema, handler }
const toolRegistry = {
  fetch_pr: {
    schema: fetchPrSchema,
    handler: (args: unknown) => fetchPr(args as FetchPrInput),
  },
};

export async function dispatchTool(
  toolName: string,
  args: unknown
): Promise<unknown> {
  const tool = toolRegistry[toolName as keyof typeof toolRegistry];
  if (!tool) throw new Error(`Unknown tool: "${toolName}"`);
  return tool.handler(args);
}

// --- Local test harness (remove when wiring to Copilot runtime) ---
async function main() {
  const owner = process.env.REPO_OWNER ?? "";
  const repo = process.env.REPO_NAME ?? "";

  if (!owner || !repo) {
    throw new Error("Set REPO_OWNER and REPO_NAME in .env");
  }

  // Simulate Copilot calling the fetch_pr tool
  const result = await dispatchTool("fetch_pr", {
    owner,
    repo,
    pr_number: 1,        // ← change to a real open PR number in your repo
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);