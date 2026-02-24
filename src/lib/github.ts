import { execa } from "execa";
import type { PrInfo, ReviewDecision, ChecksStatus } from "./types.js";

interface RawCheckRun {
  status: string;
  conclusion: string | null;
}

interface RawPr {
  headRefName: string;
  number: number;
  state: string;
  title: string;
  url: string;
  reviewDecision: string;
  statusCheckRollup: RawCheckRun[];
}

export async function getAllPrs(): Promise<Map<string, PrInfo>> {
  const { stdout } = await execa("gh", [
    "pr",
    "list",
    "--state",
    "all",
    "--json",
    "headRefName,number,state,title,url,reviewDecision,statusCheckRollup",
    "--limit",
    "100",
  ]);

  const results: RawPr[] = JSON.parse(stdout);
  const prMap = new Map<string, PrInfo>();

  for (const raw of results) {
    // Keep the first (most recent) PR per branch
    if (prMap.has(raw.headRefName)) continue;

    const state = raw.state.toLowerCase() as PrInfo["state"];
    prMap.set(raw.headRefName, {
      number: raw.number,
      state,
      title: raw.title,
      url: raw.url,
      reviewDecision: (raw.reviewDecision || "") as ReviewDecision,
      unresolvedThreads: 0,
      checksStatus: deriveChecksStatus(raw.statusCheckRollup),
    });
  }

  // Batch-fetch unresolved threads for open PRs
  const openPrs = [...prMap.entries()].filter(([, pr]) => pr.state === "open");
  if (openPrs.length > 0) {
    const threadCounts = await batchGetUnresolvedThreads(
      openPrs.map(([, pr]) => pr.number)
    );
    for (const [branch, pr] of openPrs) {
      pr.unresolvedThreads = threadCounts.get(pr.number) ?? 0;
      prMap.set(branch, pr);
    }
  }

  return prMap;
}

export function deriveChecksStatus(checks: RawCheckRun[]): ChecksStatus {
  if (checks.length === 0) return "none";

  let hasInProgress = false;
  for (const check of checks) {
    if (check.status !== "COMPLETED") {
      hasInProgress = true;
      continue;
    }
    if (
      check.conclusion === "FAILURE" ||
      check.conclusion === "TIMED_OUT" ||
      check.conclusion === "CANCELLED"
    ) {
      return "fail";
    }
  }

  return hasInProgress ? "pending" : "pass";
}

type Repo = { owner: string; name: string };

let cachedRepo: Repo | null = null;

export function resetRepoCache() {
  cachedRepo = null;
}

async function getRepo(): Promise<Repo> {
  if (cachedRepo) return cachedRepo;
  const { stdout } = await execa("gh", [
    "repo",
    "view",
    "--json",
    "owner,name",
  ]);
  const { owner, name } = JSON.parse(stdout);
  cachedRepo = { owner: owner.login, name };
  return cachedRepo;
}

async function batchGetUnresolvedThreads(
  prNumbers: number[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (prNumbers.length === 0) return result;

  try {
    const { owner, name } = await getRepo();

    // Build a single GraphQL query for all open PRs
    const prFragments = prNumbers
      .map(
        (n, i) => `pr${i}: pullRequest(number: ${n}) {
        number
        reviewThreads(first: 100) { nodes { isResolved } }
      }`
      )
      .join("\n");

    const query = `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        ${prFragments}
      }
    }`;

    const { stdout } = await execa("gh", [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
    ]);

    const data = JSON.parse(stdout);
    const repo = data.data.repository;
    for (let i = 0; i < prNumbers.length; i++) {
      const pr = repo[`pr${i}`];
      if (!pr) continue;
      const unresolved = pr.reviewThreads.nodes.filter(
        (t: { isResolved: boolean }) => !t.isResolved
      ).length;
      result.set(prNumbers[i]!, unresolved);
    }
  } catch {
    // Fail silently — thread counts default to 0
  }

  return result;
}

export async function isGhAvailable(): Promise<boolean> {
  try {
    await execa("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}
