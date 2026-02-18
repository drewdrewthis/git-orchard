import { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { Worktree } from "../lib/types.js";
import { removeWorktree } from "../lib/git.js";
import { killTmuxSession } from "../lib/tmux.js";

interface Props {
  worktrees: Worktree[];
  onDone: () => void;
}

export function Cleanup({ worktrees, onDone }: Props) {
  const merged = worktrees.filter((w) => w.pr?.state === "merged");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(merged.map((w) => w.path))
  );
  const [cursor, setCursor] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useInput(async (_input, key) => {
    if (deleting) return;

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(merged.length - 1, c + 1));
    } else if (_input === " ") {
      const path = merged[cursor]?.path;
      if (path) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
      }
    } else if (key.return) {
      if (selected.size === 0) {
        onDone();
        return;
      }
      setDeleting(true);
      for (const path of selected) {
        try {
          // Kill associated tmux session first
          const wt = merged.find((w) => w.path === path);
          if (wt?.tmuxSession) {
            try { await killTmuxSession(wt.tmuxSession); } catch { /* ok */ }
          }
          await removeWorktree(path, true);
          setDeleted((prev) => [...prev, path]);
        } catch (err) {
          setError(
            `Failed to remove ${path}: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      }
      setDeleting(false);
    } else if (_input === "q" || key.escape) {
      if (deleted.length > 0) {
        onDone();
      } else {
        onDone();
      }
    }
  });

  if (merged.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">No worktrees with merged PRs to clean up.</Text>
        <Text dimColor>Press q to go back</Text>
      </Box>
    );
  }

  if (deleting) {
    return (
      <Box flexDirection="column">
        <Text>
          <Spinner type="dots" /> Removing worktrees... ({deleted.length}/
          {selected.size})
        </Text>
        {deleted.map((p) => (
          <Text key={p} color="green">
            ✓ {p.replace(process.env.HOME || "", "~")}
          </Text>
        ))}
      </Box>
    );
  }

  if (deleted.length > 0 && !deleting) {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>
          Cleaned up {deleted.length} worktree(s):
        </Text>
        {deleted.map((p) => (
          <Text key={p} color="green">
            ✓ {p.replace(process.env.HOME || "", "~")}
          </Text>
        ))}
        {error && <Text color="red">{error}</Text>}
        <Text dimColor>Press q to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Cleanup - Worktrees with merged PRs</Text>
      <Text dimColor>
        space toggle  enter confirm  q cancel
      </Text>
      <Text> </Text>
      {merged.map((w, i) => {
        const isSelected = cursor === i;
        const isChecked = selected.has(w.path);
        const displayPath = w.path.replace(process.env.HOME || "", "~");
        return (
          <Box key={w.path}>
            <Text color={isSelected ? "cyan" : undefined}>
              {isSelected ? "▸" : " "} {isChecked ? "[✓]" : "[ ]"}{" "}
              {displayPath}
            </Text>
            <Text color="yellow" dimColor>
              {" "}
              {w.branch}
            </Text>
            <Text color="magenta" dimColor>
              {" "}
              PR #{w.pr?.number}
            </Text>
            {w.tmuxSession && (
              <Text color="blue" dimColor>
                {" "}
                tmux:{w.tmuxSession}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
