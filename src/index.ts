import * as dotenv from "dotenv";
dotenv.config();

import { fetchPr } from "../tools/fetch-pr";
import { fetchPrSchema } from "../tools/fetch-pr.schema";
import type { FetchPrInput } from "../tools/fetch-pr.schema";
import { lintCheck } from "../skills/lint-check";
import { securityScan } from "../skills/security-scan";
import type { FetchPrOutput } from "../tools/fetch-pr";

export type FullReviewOutput = {
  pr: FetchPrOutput;
  lint: Awaited<ReturnType<typeof lintCheck>>;
  security: Awaited<ReturnType<typeof securityScan>>;
};

// Runs the full review pipeline: fetch → lint + scan (parallel) → combine
export async function runFullReview(input: FetchPrInput): Promise<FullReviewOutput> {
  console.log(`Fetching PR #${input.pr_number}...`);
  const pr = await fetchPr(input);

  console.log(`Running lint and security scan in parallel...`);
  const [lint, security] = await Promise.all([
    lintCheck(pr),
    securityScan(pr),
  ]);

  return { pr, lint, security };
}

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

// --- Test harness ---
async function main() {
  const owner = process.env.REPO_OWNER ?? "";
  const repo  = process.env.REPO_NAME  ?? "";

  if (!owner || !repo) throw new Error("Set REPO_OWNER and REPO_NAME in .env");

  const result = await runFullReview({ owner, repo, pr_number: 1 });

  console.log("\n=== PR ===");
  console.log(`${result.pr.title} by @${result.pr.author}`);
  console.log(`Files changed: ${result.pr.files.length}`);

  console.log("\n=== Lint ===");
  console.log(`Passed: ${result.lint.passed} | Errors: ${result.lint.errorCount} | Warnings: ${result.lint.warningCount}`);
  result.lint.issues.slice(0, 5).forEach((i) =>
    console.log(`  [${i.severity}] ${i.filename}:${i.line} — ${i.message} (${i.rule})`)
  );

  console.log("\n=== Security ===");
  console.log(`Passed: ${result.security.passed} | Flags: ${result.security.flags.length}`);
  result.security.flags.forEach((f) =>
    console.log(`  [${f.severity}] ${f.filename}:${f.line} — ${f.detail}`)
  );
}

main().catch(console.error);
