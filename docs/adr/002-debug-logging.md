# ADR-002: File-based Debug Logging

**Date:** 2026-03-03

**Status:** Accepted

## Context

Debugging git-orchard issues requires ad-hoc `console.error` calls and manual reproduction. The TUI renders to stdout/stderr, making runtime console output impractical. We need a persistent log that captures operations with timing info without interfering with the UI.

Key constraints:
- Log output must not appear in the terminal (TUI owns stdout/stderr)
- Log volume is low — a handful of lines per refresh cycle
- Must not add async complexity to hot paths
- Must stay bounded on disk

## Decision

We will write debug logs to `~/.local/state/git-orchard/debug.log` using synchronous file appends.

**Location:** `~/.local/state/git-orchard/debug.log` follows the XDG Base Directory spec for application state data.

**Format:** `[ISO timestamp] [LEVEL] message` — one line per entry, levels are INFO, WARN, ERROR.

**Rotation:** On startup, if the file exceeds 10MB, rename it to `debug.log.1` and start fresh. This keeps at most ~20MB on disk with zero external dependencies.

**API:** `log.info()`, `log.warn()`, `log.error()` for messages; `log.time(label)` / `log.timeEnd(label)` for measuring phase durations.

**Writes:** `fs.appendFileSync` — synchronous because log volume is low (dozens of lines per minute at most) and async would add complexity for no measurable benefit.

**Failure mode:** All log operations silently fail. Logging must never crash the app.

## Consequences

- Developers can inspect `~/.local/state/git-orchard/debug.log` to diagnose issues without reproducing them live.
- Phase timing (`phase:git`, `phase:tmux+gh`, etc.) makes it easy to identify slow operations.
- The synchronous write adds negligible latency given the low volume.
- Log rotation is simple but effective — no log management tooling needed.
- New features should add `log.info`/`log.time` calls at operation boundaries (entering a mode, calling an external tool, completing a batch).
