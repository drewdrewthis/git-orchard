import { execaSync, execa } from "execa";
import { resolve } from "node:path";
import type { Worktree } from "./types.js";

function findRepoRoot(): string {
  const { stdout } = execaSync("git", ["rev-parse", "--show-toplevel"]);
  return stdout.trim();
}

function resolveMainWorktreePath(gitDir: string): string {
  try {
    const { stdout } = execaSync("git", ["config", "--get", "core.worktree"], {
      env: { ...process.env, GIT_DIR: gitDir },
    });
    return resolve(gitDir, stdout.trim());
  } catch {
    return gitDir;
  }
}

export function listWorktrees(): Worktree[] {
  const cwd = findRepoRoot();
  const { stdout } = execaSync("git", ["worktree", "list", "--porcelain"], { cwd });
  return parsePorcelain(stdout).map((wt) =>
    wt.path.includes("/.git/") ? { ...wt, path: resolveMainWorktreePath(wt.path) } : wt
  );
}

export function parsePorcelain(output: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const blocks = output.trim().split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split("\n");
    let path = "";
    let head = "";
    let branch: string | null = null;
    let isBare = false;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        path = line.slice("worktree ".length);
      } else if (line.startsWith("HEAD ")) {
        head = line.slice("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        // refs/heads/main -> main
        branch = line.slice("branch ".length).replace("refs/heads/", "");
      } else if (line === "bare") {
        isBare = true;
      } else if (line === "detached") {
        branch = null;
      }
    }

    if (path) {
      worktrees.push({ path, head, branch, isBare, pr: null, prLoading: false, tmuxSession: null, tmuxAttached: false });
    }
  }

  return worktrees;
}

export async function removeWorktree(
  path: string,
  force = false
): Promise<void> {
  const args = ["worktree", "remove", path];
  if (force) args.push("--force");
  await execa("git", args);
}