export const fetchPrSchema = {
  name: "fetch_pr",
  description:
    "Fetches a GitHub pull request's metadata (title, body, author, labels) " +
    "and the unified diff for every changed file.",
  parameters: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub repository owner (username or org name)",
      },
      repo: {
        type: "string",
        description: "Repository name (without the owner prefix)",
      },
      pr_number: {
        type: "number",
        description: "The pull request number to fetch",
      },
    },
    required: ["owner", "repo", "pr_number"],
  },
} as const;

export type FetchPrInput = {
  owner: string;
  repo: string;
  pr_number: number;
};