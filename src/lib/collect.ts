import { fetchGitWorktrees, fetchTmuxAndGh, mergeTmuxSessions, fetchPrBasics, applyPrs, enrichPrs } from "../hooks/useWorktrees.js";
import { loadConfig } from "./config.js";
import { fetchRemoteWorktrees } from "./remote.js";
import type { Worktree } from "./types.js";

export async function collectWorktreeData(): Promise<Worktree[]> {
  const trees = fetchGitWorktrees();
  const { sessions, ghOk } = await fetchTmuxAndGh();
  const withTmux = mergeTmuxSessions(trees, sessions, ghOk);

  if (!ghOk) return withTmux;

  const prMap = await fetchPrBasics();
  const config = loadConfig();

  const [, ...remoteResults] = await Promise.all([
    enrichPrs(prMap),
    ...config.remotes.map((remote) => fetchRemoteWorktrees(remote)),
  ]);
  const remoteTrees = remoteResults.flat();

  const localWithPrs = applyPrs(withTmux, prMap);
  const remotesWithPrs = remoteTrees.map((tree) => {
    if (!tree.branch || tree.isBare) return tree;
    return { ...tree, pr: prMap.get(tree.branch) ?? null };
  });

  return [...localWithPrs, ...remotesWithPrs];
}
