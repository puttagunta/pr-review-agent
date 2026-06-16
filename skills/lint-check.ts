import { Linter } from "eslint";
import * as path from "path";
import type { FetchPrOutput } from "../tools/fetch-pr";

export type LintIssue = {
  filename: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  rule: string;
  message: string;
};

export type LintCheckOutput = {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
};

const LINTABLE = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

export async function lintCheck(pr: FetchPrOutput): Promise<LintCheckOutput> {
  const linter = new Linter();

  // Define rules inline — no config file needed
  const config: Linter.Config<Linter.RulesRecord> = {
    rules: {
        "no-unused-vars": "warn",
        "no-console": "warn",
        "eqeqeq": "error",
        "no-eval": "error",
        "no-var": "warn",
        "prefer-const": "warn",
    },
  } as Linter.Config;

  const issues: LintIssue[] = [];

  for (const file of pr.files) {
    const ext = path.extname(file.filename);
    if (!LINTABLE.includes(ext)) continue;
    if (file.status === "removed") continue;

    // Extract only added lines from the diff
    const addedLines = file.diff
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1));

    const code = addedLines.join("\n");
    if (!code.trim()) continue;

    // Run ESLint in-process — no CLI, no temp files
    const messages = linter.verify(code, config, {
    filename: file.filename,
    allowInlineConfig: false,
    });

    for (const msg of messages) {
      issues.push({
        filename: file.filename,
        line: msg.line,
        column: msg.column,
        severity: msg.severity === 2 ? "error" : "warning",
        rule: msg.ruleId ?? "unknown",
        message: msg.message,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return { passed: errorCount === 0, errorCount, warningCount, issues };
}
