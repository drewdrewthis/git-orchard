Feature: Menu UI Performance
  As a developer using git-orchard
  I want the TUI to be responsive during navigation and rendering
  So that keystrokes feel instant and the UI does not lag or stutter

  # Dropped fixes (negligible impact per challenge review):
  # - Fix 4: React.memo WorktreeRow — Ink re-diffs entire terminal output regardless
  # - Fix 5: useMemo layout widths — 3 arithmetic ops, useMemo overhead > computation

  Background:
    Given git-orchard is running in the orchard TUI
    And the worktree list is displayed with multiple worktrees

  # ===========================================================================
  # Fix 1: Cache loadConfig() — called on every render and keystroke
  # Cache in useRef, re-read only on explicit refresh()
  # ===========================================================================

  @integration
  Scenario: loadConfig result is cached after initial load
    Given WorktreeList has mounted
    When the component re-renders 10 times due to cursor navigation
    Then loadConfig executes at most once
    And the same config object is returned on each access

  @integration
  Scenario: cached config is used inside useInput handler
    Given WorktreeList has mounted with a remote configured
    When the user presses "t" on a remote worktree
    Then loadConfig is not called during the input handler
    And the cached config is used to read remote settings

  @integration
  Scenario: config cache is invalidated on manual refresh
    Given WorktreeList has mounted and config is cached
    And the user modifies orchard.json in another terminal
    When the user presses "r" to refresh
    Then loadConfig re-reads the config file from disk
    And the new config values are used for the refresh cycle

  # ===========================================================================
  # Fix 2: Move execaSync("git rev-parse") out of render path
  # Compute repo root in useEffect on mount, store in useRef
  # ===========================================================================

  @integration
  Scenario: git rev-parse is not called during render
    Given a transfer target worktree is set
    When WorktreeList renders the Transfer view
    Then execaSync is not called synchronously in the render body
    And the repo root is available from a pre-computed value

  @integration
  Scenario: repo root is computed once on mount
    Given WorktreeList has mounted
    When transferTarget changes multiple times
    Then git rev-parse --show-toplevel runs at most once
    And each Transfer render receives the same repo root value

  # ===========================================================================
  # Fix 3: Reduce setState calls in useWorktrees refresh
  # Merge sequential awaits into fewer updates while preserving
  # progressive rendering (local worktrees appear fast, then enrich)
  # ===========================================================================

  @unit
  Scenario: refresh produces at most 3 intermediate renders
    Given useWorktrees is mounted
    When refresh completes a full cycle with git, tmux, PRs, remote, and issues
    Then setWorktrees is called at most 3 times
    And the final call contains all local and remote worktrees with PRs and issue states

  @unit
  Scenario: intermediate state always includes stale remote worktrees
    Given useWorktrees has remote worktrees from a previous refresh
    When a new refresh cycle begins
    Then every intermediate setWorktrees call preserves existing remote worktrees
    And remote worktrees are never briefly removed from the list

  @unit
  Scenario: local worktrees appear before network enrichment completes
    Given useWorktrees is mounted
    When refresh begins and fetchGitWorktrees completes
    Then local worktrees are displayed immediately
    And PR and remote data is merged in when available

  # ===========================================================================
  # Fix 6: Kill SSH processes on selection change
  # Use execa cancel/kill to actually terminate SSH child processes,
  # not just ignore results
  # ===========================================================================

  @integration
  Scenario: SSH preview process is killed when selection changes
    Given worktree A has a tmux session and a remote preview SSH is in flight
    When the user moves the cursor to worktree B before the SSH response arrives
    Then the SSH child process for worktree A is killed
    And a new SSH capture starts for worktree B

  @integration
  Scenario: stale SSH preview result is discarded after selection change
    Given an SSH capture for worktree A is in flight
    When the cursor moves to worktree B
    And the SSH response for worktree A arrives after the move
    Then the response for worktree A is not applied to paneContent
    And paneContent reflects worktree B

  @unit
  Scenario: preview useEffect cleanup kills pending SSH process
    Given a remote preview SSH capture is in flight
    When the useEffect for pane capture runs its cleanup function
    Then the SSH child process is terminated
    And no setState is called with the stale result
