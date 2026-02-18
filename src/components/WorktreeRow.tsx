import { Box, Text } from "ink";
import { StatusBadge } from "./StatusBadge.js";
import { shortPath } from "../lib/paths.js";
import type { Worktree } from "../lib/types.js";

interface Props {
  worktree: Worktree;
  isSelected: boolean;
  pathWidth: number;
  branchWidth: number;
  rootPath: string;
}

export function WorktreeRow({
  worktree,
  isSelected,
  pathWidth,
  branchWidth,
  rootPath,
}: Props) {
  const displayPath = shortPath(worktree.path, rootPath);

  return (
    <Box>
      <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
        {isSelected ? " >" : "  "}{" "}
      </Text>
      <Box width={pathWidth}>
        <Text color={isSelected ? "cyan" : undefined} bold={isSelected} wrap="truncate">
          {displayPath}
        </Text>
      </Box>
      <Text>  </Text>
      <Box width={branchWidth}>
        <Text
          color="yellow"
          dimColor={!isSelected}
          wrap="truncate"
        >
          {worktree.branch || "(detached)"}
        </Text>
      </Box>
      <Text>  </Text>
      {worktree.isBare ? (
        <Text dimColor>(bare)</Text>
      ) : (
        <StatusBadge
          pr={worktree.pr}
          loading={worktree.prLoading}
        />
      )}
      {worktree.tmuxSession && (
        <>
          <Text>  </Text>
          <Text color={worktree.tmuxAttached ? "green" : "blue"}>
            {worktree.tmuxAttached ? "▶" : "◼"} tmux:{worktree.tmuxSession}
          </Text>
        </>
      )}
    </Box>
  );
}
