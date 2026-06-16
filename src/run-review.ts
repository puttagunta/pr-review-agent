import * as dotenv from "dotenv";
dotenv.config();

import { execSync } from "child_process";
import { runFullReview } from "./index";
import { formatReview } from "./format-review";

async function main() {
  // In Actions these come from the workflow env block
  // Locally they come from .env
  const owner    = process.env.REPO_OWNER ?? "";
  const repo     = process.env.REPO_NAME  ?? "";
  const prNumber = parseInt(process.env.PR_NUMBER ?? "0", 10);

  if (!owner || !repo || !prNumber) {
    throw new Error(
      "Missing required env vars: REPO_OWNER, REPO_NAME, PR_NUMBER"
    );
  }

  console.log(`Running full review on PR #${prNumber} in ${owner}/${repo}...`);

  const result  = await runFullReview({ owner, repo, pr_number: prNumber });
  const comment = formatReview(result);

  console.log("\n--- Review comment preview ---\n");
  console.log(comment);
  console.log("\n--- End preview ---\n");

  // Post the comment via gh CLI
  try {
    // Write comment to a temp file to avoid shell escaping issues
    const { writeFileSync } = await import("fs");
    writeFileSync("/tmp/review-comment.md", comment, "utf8");

    execSync(
      `gh pr comment ${prNumber} --repo ${owner}/${repo} --body-file /tmp/review-comment.md`,
      { stdio: "inherit" }
    );

    console.log(`✅ Review posted to PR #${prNumber}`);
  } catch (e) {
    console.error("Failed to post comment via gh CLI:", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
