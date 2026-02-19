import { execa } from "execa";
import type { PrInfo, ReviewDecision } from "./types.js";

type Repo = { owner: string; name: string };

let cachedRepo: Repo | null = null;

export function resetRepoCache() {
  cachedRepo = null;
}

async function getRepo(): Promise<Repo> {
  if (cachedRepo) return cachedRepo;
  const { stdout } = await execa("gh", ["repo", "view", "--json", "owner,name"]);
  const { owner, name } = JSON.parse(stdout);
  cachedRepo = { owner: owner.login, name };
  return cachedRepo;
}

async function getUnresolvedThreads(prNumber: number): Promise<number> {
  try {
    const { owner, name } = await getRepo();
    const query = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes { isResolved }
            }
          }
        }
      }
    `;

    const { stdout } = await execa("gh", [
      "api", "graphql",
      "-f", `query=${query}`,
      "-f", `owner=${owner}`,
      "-f", `name=${name}`,
      "-F", `number=${prNumber}`,
    ]);

    const data = JSON.parse(stdout);
    const threads = data.data.repository.pullRequest.reviewThreads.nodes;
    return threads.filter((t: { isResolved: boolean }) => !t.isResolved).length;
  } catch {
    return 0;
  }
}

export async function getPrForBranch(
  branch: string
): Promise<PrInfo | null> {
  try {
    const { stdout } = await execa("gh", [
      "pr",
      "list",
      "--head",
      branch,
      "--state",
      "all",
      "--json",
      "number,state,title,url,reviewDecision",
      "--limit",
      "1",
    ]);

    const results = JSON.parse(stdout);
    if (!results.length) return null;

    const pr = results[0];
    const state = pr.state.toLowerCase() as PrInfo["state"];

    let unresolvedThreads = 0;
    if (state === "open") {
      unresolvedThreads = await getUnresolvedThreads(pr.number);
    }

    return {
      number: pr.number,
      state,
      title: pr.title,
      url: pr.url,
      reviewDecision: (pr.reviewDecision || "") as ReviewDecision,
      unresolvedThreads,
    };
  } catch {
    // gh not installed or not authenticated or not a GitHub repo
    return null;
  }
}

export async function isGhAvailable(): Promise<boolean> {
  try {
    await execa("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}
