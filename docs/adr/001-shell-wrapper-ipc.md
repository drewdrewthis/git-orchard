# ADR-001: Shell Wrapper with Temp File IPC

**Date:** 2026-02-24

**Status:** Accepted

## Context

Git Orchard is a Node.js TUI (via Ink) that manages git worktrees. Two core features require actions that a child process cannot perform on the parent shell: changing the working directory (`cd`) and attaching to a tmux session. A Node process can't modify its parent shell's state directly.

## Decision

We use a two-part architecture: a Node CLI (`git-orchard`) that writes commands to temp files, wrapped by a shell function (`orchard()`) that reads and executes those commands after the CLI exits.

The shell function is installed in the user's `.zshrc`/`.bashrc` via `git-orchard init`. It:

1. Runs `command git-orchard "$@"` (the Node TUI)
2. Reads temp files atomically (`mv` then `cat` to avoid TOCTOU races)
3. Executes the command: either `cd` to a worktree or `eval` a tmux attach/new-session
4. Re-launches `orchard` after tmux detach so the user returns to the TUI

Temp files are per-user (`/tmp/git-orchard-*-$uid`) with `0600` permissions.

## Rationale

**Why not a single binary?** Node can't `cd` or `tmux attach` in the parent shell. The shell wrapper is the only way to bridge this gap.

**Why temp files over stdout parsing?** Temp files are simpler and don't interfere with the TUI's terminal output. Stdout-based IPC would conflict with Ink's rendering.

**Why `mv` before `cat`?** Prevents a race where the file is read by one shell invocation while being written by another. The atomic rename ensures each command is consumed exactly once.

## Consequences

- Users must run `git-orchard init` and source the shell function — `npx git-orchard` alone can't cd or attach tmux
- The shell function is the source of truth for IPC behavior; changes to temp file paths must stay in sync between `src/lib/paths.ts` and `src/lib/shell.ts`
- Temp files in `/tmp` are ephemeral by design — no cleanup needed across reboots

**Key files:** `src/lib/shell.ts`, `src/lib/paths.ts`, `src/components/WorktreeList.tsx` (writes temp files on `enter`/`t` keypress)
