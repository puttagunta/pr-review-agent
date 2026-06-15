import * as dotenv from "dotenv";
dotenv.config();

import type { FetchPrInput } from "./fetch-pr.schema";

type GitHubFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

type PrMetadata = {
  title: string;
  number: number;
  state: string;
  body: string | null;
  user: { login: string };
  labels: Array<{ name: string }>;
  created_at: string;
  html_url: string;
};

export type FetchPrOutput = {
  title: string;
  number: number;
  state: string;
  author: string;
  body: string;
  labels: string[];
  url: string;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    diff: string;
  }>;
};

export async function fetchPr(input: FetchPrInput): Promise<FetchPrOutput> {
  const { owner, repo, pr_number } = input;
  const token = process.env.GITHUB_TOKEN;

  if (!token) throw new Error("GITHUB_TOKEN is not set in environment");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Fetch PR metadata
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}`,
    { headers }
  );

  if (!prRes.ok) {
    const err = await prRes.json() as { message: string };
    throw new Error(`GitHub API error: ${err.message}`);
  }

  const pr = await prRes.json() as PrMetadata;

  // Fetch changed files
  const filesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}/files`,
    { headers }
  );

  if (!filesRes.ok) {
    const err = await filesRes.json() as { message: string };
    throw new Error(`GitHub API error (files): ${err.message}`);
  }

  const files = await filesRes.json() as GitHubFile[];

  return {
    title: pr.title,
    number: pr.number,
    state: pr.state,
    author: pr.user.login,
    body: pr.body ?? "(no description)",
    labels: pr.labels.map((l) => l.name),
    url: pr.html_url,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      diff: f.patch ?? "(binary or no diff available)",
    })),
  };
}