import { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { Worktree } from "../lib/types.js";
import { removeWorktree } from "../lib/git.js";
import { killTmuxSession } from "../lib/tmux.js";

interface Props {
  worktree: Worktree;
  onDone: () => void;
  onCancel: () => void;
}

export function ConfirmDelete({ worktree, onDone, onCancel }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useInput(async (_input, key) => {
    if (deleting) return;

    if (_input === "y" || _input === "Y") {
      setDeleting(true);
      try {
        // Kill tmux session first if one exists
        if (worktree.tmuxSession) {
          try {
            await killTmuxSession(worktree.tmuxSession);
          } catch {
            // session may already be dead
          }
        }
        await removeWorktree(worktree.path);
        onDone();
      } catch (err) {
        // Try with force
        try {
          await removeWorktree(worktree.path, true);
          onDone();
        } catch (err2) {
          setError(
            err2 instanceof Error ? err2.message : "Failed to delete"
          );
        }
      }
    } else if (_input === "n" || _input === "N" || key.escape) {
      onCancel();
    }
  });

  const displayPath = worktree.path.replace(process.env.HOME || "", "~");

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press any key to go back</Text>
      </Box>
    );
  }

  if (deleting) {
    return (
      <Text>
        <Spinner type="dots" /> Removing {displayPath}...
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        Delete worktree <Text color="yellow">{worktree.branch}</Text> at{" "}
        <Text color="cyan">{displayPath}</Text>?
      </Text>
      {worktree.pr?.state === "merged" && (
        <Text color="magenta">PR #{worktree.pr.number} is merged.</Text>
      )}
      {worktree.tmuxSession && (
        <Text color="blue">tmux session "{worktree.tmuxSession}" will be killed.</Text>
      )}
      <Text>
        <Text color="green" bold>
          y
        </Text>
        {" yes  "}
        <Text color="red" bold>
          n
        </Text>
        {" no"}
      </Text>
    </Box>
  );
}
