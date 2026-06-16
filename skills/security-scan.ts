import { execSync } from "child_process";
import * as fs from "fs";
import type { FetchPrOutput } from "../tools/fetch-pr";

export type SecurityFlag = {
  filename: string;
  line: number;
  type: "secret" | "vulnerable-dep" | "dangerous-pattern";
  severity: "high" | "medium" | "low";
  detail: string;
};

export type SecurityScanOutput = {
  passed: boolean;
  flags: SecurityFlag[];
};

// Patterns that suggest hardcoded secrets
const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /['"][A-Za-z0-9+/]{40,}['"]/,        label: "Possible hardcoded token" },
  { pattern: /PRIVATE KEY/,                          label: "Private key material" },
  { pattern: /password\s*=\s*['"][^'"]{4,}['"]/i,  label: "Hardcoded password" },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]{8,}['"]/i, label: "Hardcoded API key" },
  { pattern: /secret\s*=\s*['"][^'"]{8,}['"]/i,    label: "Hardcoded secret" },
  { pattern: /ghp_[A-Za-z0-9]{36}/,                label: "GitHub PAT in code" },
  { pattern: /sk-[A-Za-z0-9]{32,}/,                label: "OpenAI-style API key" },
];

// Patterns that signal dangerous code practices
const DANGER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /eval\s*\(/,             label: "Use of eval()" },
  { pattern: /child_process\.exec\b/, label: "Unsanitized shell exec" },
  { pattern: /\.innerHTML\s*=/,       label: "Direct innerHTML assignment (XSS risk)" },
  { pattern: /Math\.random\(\)/,      label: "Weak random — don't use for security" },
];

export async function securityScan(
  pr: FetchPrOutput
): Promise<SecurityScanOutput> {
  const flags: SecurityFlag[] = [];

  for (const file of pr.files) {
    if (file.status === "removed") continue;

    const addedLines = file.diff
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    addedLines.forEach((rawLine, idx) => {
      const line = rawLine.slice(1); // strip leading "+"
      const lineNumber = idx + 1;

      for (const { pattern, label } of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          flags.push({
            filename: file.filename,
            line: lineNumber,
            type: "secret",
            severity: "high",
            detail: label,
          });
        }
      }

      for (const { pattern, label } of DANGER_PATTERNS) {
        if (pattern.test(line)) {
          flags.push({
            filename: file.filename,
            line: lineNumber,
            type: "dangerous-pattern",
            severity: "medium",
            detail: label,
          });
        }
      }
    });
  }

  // If package.json changed, run npm audit
  const pkgChanged = pr.files.some((f) => f.filename === "package.json");
  if (pkgChanged) {
    try {
      const tmpDir = fs.mkdtempSync("/tmp/pr-audit-");
      const pkgFile = pr.files.find((f) => f.filename === "package.json");

      if (pkgFile) {
        const content = pkgFile.diff
          .split("\n")
          .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
          .map((l) => l.slice(1))
          .join("\n");

        fs.writeFileSync(`${tmpDir}/package.json`, content);

        try {
          execSync("npm audit --json", { cwd: tmpDir, encoding: "utf8" });
        } catch (e: unknown) {
          type AuditReport = {
            vulnerabilities: Record<string, { severity: string; via: Array<{ title?: string }> }>;
          };
          const report: AuditReport = JSON.parse(
            (e as { stdout: string }).stdout ?? "{}"
          );

          for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
            flags.push({
              filename: "package.json",
              line: 0,
              type: "vulnerable-dep",
              severity: vuln.severity === "critical" || vuln.severity === "high" ? "high" : "medium",
              detail: `${pkg}: ${vuln.via[0]?.title ?? vuln.severity}`,
            });
          }
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }
    } catch {
      // npm audit unavailable — skip silently
    }
  }

  return {
    passed: flags.filter((f) => f.severity === "high").length === 0,
    flags,
  };
}
