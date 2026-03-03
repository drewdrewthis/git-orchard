import { useState, useEffect, useCallback, useRef } from "react";
import { listWorktrees } from "../lib/git.js";
import { getAllPrs, enrichPrDetails, isGhAvailable } from "../lib/github.js";
import { listTmuxSessions, findSessionForWorktree } from "../lib/tmux.js";
import { log } from "../lib/log.js";
import type { Worktree } from "../lib/types.js";

const AUTO_REFRESH_MS = 60_000;

export function useWorktrees() {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      // Phase 1: git data (synchronous, fast)
      log.time("phase:git");
      const trees = listWorktrees();
      log.timeEnd("phase:git");
      log.info(`worktrees: ${trees.length} found`);
      setWorktrees(trees.map((t) => ({ ...t, prLoading: !t.isBare && !!t.branch })));
      setLoading(false);

      // Phase 2: tmux + gh check (parallel)
      log.time("phase:tmux+gh");
      const [sessions, ghOk] = await Promise.all([
        listTmuxSessions(),
        isGhAvailable(),
      ]);
      log.timeEnd("phase:tmux+gh");

      const withTmux = trees.map((t) => {
        const session = findSessionForWorktree(sessions, t.path, t.branch);
        return {
          ...t,
          tmuxSession: session?.name ?? null,
          tmuxAttached: session?.attached ?? false,
          prLoading: !t.isBare && !!t.branch && ghOk,
        };
      });

      if (!ghOk) {
        setWorktrees(withTmux);
        return;
      }

      setWorktrees(withTmux);

      // Phase 3: batch fetch PR basics (fast -- no statusCheckRollup)
      log.time("phase:pr-basics");
      const prMap = await getAllPrs();
      log.timeEnd("phase:pr-basics");
      log.info(`PRs: ${prMap.size} found`);
      const applyPrs = (base: Worktree[]) =>
        base.map((t) => {
          if (!t.branch || t.isBare) return { ...t, prLoading: false };
          return { ...t, pr: prMap.get(t.branch) ?? null, prLoading: false };
        });

      setWorktrees(applyPrs(withTmux));

      // Phase 4: enrich open PRs with checks + threads (slow, non-blocking)
      log.time("phase:pr-enrich");
      await enrichPrDetails(prMap);
      log.timeEnd("phase:pr-enrich");
      setWorktrees(applyPrs(withTmux));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list worktrees";
      log.error(`refresh failed: ${message}`);
      setError(message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refresh();
    }, AUTO_REFRESH_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh]);

  return { worktrees, loading, error, refresh };
}
