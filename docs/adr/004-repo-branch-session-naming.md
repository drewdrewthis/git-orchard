# ADR-004: repo:branch Tmux Session Naming

**Date:** 2026-03-13

**Status:** Accepted

## Context

Git Orchard creates one tmux session per worktree. Sessions need a stable, human-readable name. The original convention used the bare branch slug (`feat-login`) or the worktree directory name as the session name.

This breaks when a user has the same branch name in multiple repos — e.g. both `frontend` and `backend` repos have a `main` worktree. Two sessions named `main` cannot coexist in a single tmux server, so the second `switchToSession` call would attach to the wrong session.

## Decision

We will name sessions in the format `repoName:branch` (e.g. `myrepo:feat-login`, `frontend:main`). The repo name is the basename of the git repo root directory. The branch portion replaces `/` with `-` to satisfy tmux's session name constraints.

`deriveSessionName(repoName, branch, worktreePath)` encodes this: it produces `repoName:branchSlug`, falling back to the worktree directory basename when the HEAD is detached.

**Backwards compatibility.** `findSessionForWorktree` is the lookup function used when associating running sessions with worktrees at startup. It handles both formats:

1. Exact path match (`session.path === worktreePath`) — format-agnostic.
2. Name match — strips the `repo:` prefix by splitting on the last `:` and comparing the suffix against the branch slug and directory name. It also accepts bare names (no colon) as legacy matches.

This means existing sessions created under the old naming scheme continue to match until they are killed and recreated.

## Rationale

**Why `:` as the separator?** The colon is not valid in branch names (git forbids it), so it unambiguously separates the repo qualifier from the branch. It is also visually readable in `tmux ls` output.

**Why the repo basename rather than a full path?** Full paths are too long for tmux's status bar and `tmux ls` output. The basename is almost always unique enough in practice and matches what users already see in their prompt.

**Why not a hash or UUID?** Human-readable names matter for users who interact with tmux directly. A session named `myrepo:feat-login` is immediately meaningful; a UUID is not.

## Consequences

- Sessions created before this change retain their old names. `findSessionForWorktree` still matches them via the bare-name fallback paths, so the UI shows them as attached. They are renamed only when the session is killed and a new one is created.
- Remote bridging sessions (ADR-003) are prefixed with `remote_` in addition to the `repo:branch` name, producing names like `remote_myrepo:feat-login`. The `remote_` prefix is applied in `attachRemoteSession`, not in `deriveSessionName`.
- The `:` character must be escaped or quoted in shell contexts when passed directly to `tmux -t`. The codebase passes session names as discrete arguments to `execa`, which avoids shell quoting entirely.
- `deriveSessionName` is now the single source of truth for naming. Any new code that creates a tmux session for a worktree must go through it.

**Key files:** `src/lib/tmux.ts` (`deriveSessionName`, `findSessionForWorktree`), `src/lib/transfer.ts` (calls `deriveSessionName` for both push and pull directions)
