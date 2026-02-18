import { useState, useEffect, useCallback } from "react";
import { listWorktrees } from "../lib/git.js";
import { getPrForBranch, isGhAvailable } from "../lib/github.js";
import { listTmuxSessions, findSessionForWorktree } from "../lib/tmux.js";
import type { Worktree } from "../lib/types.js";

export function useWorktrees() {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      // Phase 1: git data (synchronous, fast)
      const trees = listWorktrees();
      setWorktrees(trees.map((t) => ({ ...t, prLoading: !t.isBare && !!t.branch })));
      setLoading(false);

      // Phase 2: tmux sessions (fast, parallel with PR fetch)
      const tmuxPromise = listTmuxSessions();

      // Phase 3: PR data (async, slow)
      const ghOk = await isGhAvailable();
      const sessions = await tmuxPromise;

      // Enrich trees with tmux data
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
        setWorktrees(withTmux.map((t) => ({ ...t, prLoading: false })));
        return;
      }

      setWorktrees(withTmux);

      const withPrs = await Promise.all(
        withTmux.map(async (t) => {
          if (!t.branch || t.isBare) return { ...t, prLoading: false };
          const pr = await getPrForBranch(t.branch);
          return { ...t, pr, prLoading: false };
        })
      );
      setWorktrees(withPrs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to list worktrees"
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { worktrees, loading, error, refresh };
}
