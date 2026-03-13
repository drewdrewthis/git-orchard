# ADR-003: Remote Worktree Architecture

**Date:** 2026-03-13

**Status:** Accepted

## Context

Git Orchard manages worktrees on the local machine. A common workflow involves moving in-progress work to a remote machine — for example, pushing to a powerful dev server and continuing there, or pulling from a remote machine back to a laptop. Both directions need to: transfer the branch, set up a tmux session on the destination, and tear down the source.

The remote machine already runs git and tmux. The local machine has SSH access. The challenge is orchestrating these steps atomically enough that a failure doesn't leave orphaned worktrees or sessions on either side.

## Decision

We bridge local and remote tmux over SSH/mosh using a three-layer approach:

**1. SSH as the transport.** All remote commands run via `sshExec`, which wraps `ssh` with `ControlMaster`/`ControlPersist` for connection multiplexing. A single TCP connection is reused across the multiple SSH invocations in a transfer, keeping latency manageable.

**2. Git as the transfer protocol.** Push and pull operations move work through the shared git remote (`origin`). For `pushToRemote`: stage uncommitted changes, commit them as `[orchard] WIP handoff`, push the branch, then `git worktree add` on the remote pointing at `origin/<branch>`. For `pullToLocal`: reverse — commit on the remote, push from there, fetch locally, `git worktree add` locally. Teardown (killing the source session and removing the source worktree) only runs after the destination is fully set up, so a failure mid-transfer leaves the source intact.

**3. A local bridging tmux session for attachment.** When the user opens a remote worktree, `attachRemoteSession` creates a local tmux session named `remote_<sessionName>` whose command is `ssh -tt <host> tmux attach-session -t <sessionName>` (or the mosh equivalent). The user attaches to this local session; the remote session is visible through it. This keeps the existing shell-wrapper IPC (ADR-001) working unchanged — the wrapper attaches to a local tmux session and the remote tunnels through it.

**Registry fallback for `removeRemoteWorktree`.** The remote `git worktree remove` command only works for paths that are in git's worktree registry. If the registry entry is missing (e.g. the worktree directory was created by an older version or by hand), `git worktree remove` fails with "is not a working tree". In that case we fall back to `git worktree prune` (to sync the registry) followed by `rm -rf` on the path directly.

## Rationale

**Why git as the transfer medium?** Using `git push/pull` leverages existing authentication, compression, and history preservation. Alternatives like `rsync` would transfer file data but lose git semantics and require separate credential handling.

**Why a local bridging session rather than direct attachment?** `tmux switch-client` can only target sessions in the local tmux server. A bridging session lets the shell wrapper remain unaware of remote topology — it always switches to a local session name.

**Why mosh as an option?** SSH connections drop on network changes (roaming, sleep/wake). Mosh maintains a persistent session over UDP, which matters for long-lived connections to remote dev boxes.

**Why defer teardown until after setup succeeds?** A failed transfer should leave the user's work accessible somewhere. Tearing down the source first would risk data loss on a mid-transfer error.

## Consequences

- **Connection multiplexing** means the first SSH call in a transfer pays the handshake cost; subsequent calls reuse the socket. The control socket lives at `/tmp/orchard-ssh-%r@%h:%p`.
- **Worktrees land in a sibling `worktrees/` directory** on both local and remote (`../worktrees/worktree-<slug>` relative to the repo root). This is a convention; changing it would break `deriveRemoteWorktreePath` and `deriveLocalWorktreePath`.
- **The WIP handoff commit** leaves a dangling commit in history if the user never cleans it up. This is intentional — it preserves work across transfer and can be squashed later.
- **`remain-on-exit`** is set on bridging sessions so that a dropped SSH connection doesn't destroy the local session immediately, giving the user a chance to see the error output before reattaching.
- **Remote session naming** follows the same `repo:branch` convention as local sessions (ADR-004), derived by `deriveSessionName` using the remote repo's basename.

**Key files:** `src/lib/remote.ts`, `src/lib/transfer.ts`
