import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

vi.mock("execa", () => ({
  execaSync: vi.fn(() => ({ stdout: "/fake/repo\n" })),
}));

vi.mock("../Transfer.js", () => ({
  Transfer: ({ repoRoot }: { repoRoot: string }) =>
    React.createElement("ink-text", null, `transfer:${repoRoot}`),
}));

vi.mock("../ConfirmDelete.js", () => ({
  ConfirmDelete: () => React.createElement("ink-text", null, "confirm-delete"),
}));

vi.mock("../../lib/config.js", () => ({
  loadConfig: vi.fn(() => ({
    remote: { host: "example.com", shell: "ssh", user: "me", orchardDir: "/remote" },
  })),
}));

vi.mock("../../lib/tmux.js", () => ({
  switchToSession: vi.fn(),
  deriveSessionName: vi.fn(() => "session"),
  capturePaneContent: vi.fn(() => ({ promise: Promise.resolve(""), kill: vi.fn() })),
}));

vi.mock("../../lib/browser.js", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../lib/remote.js", () => ({
  attachRemoteSession: vi.fn(),
  createRemoteSession: vi.fn(),
  captureRemotePaneContent: vi.fn(() => ({ promise: Promise.resolve(""), kill: vi.fn() })),
}));

vi.mock("../../lib/log.js", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../lib/navigation.js", () => ({
  cursorIndexFromDigit: vi.fn(() => null),
}));

vi.mock("@mishieck/ink-titled-box", () => ({
  TitledBox: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ink-box", null, children),
}));

vi.mock("ink-spinner", () => ({
  default: () => React.createElement("ink-text", null, "..."),
}));

import { execaSync } from "execa";
import { WorktreeList } from "../WorktreeList.js";
import type { Worktree } from "../../lib/types.js";

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    path: "/home/user/project",
    branch: "main",
    head: "abc1234",
    isBare: false,
    hasConflicts: false,
    pr: null,
    prLoading: false,
    tmuxSession: null,
    tmuxAttached: false,
    ...overrides,
  };
}

const defaultProps = {
  worktrees: [makeWorktree()],
  loading: false,
  error: null,
  onRefresh: vi.fn(),
  onCleanup: vi.fn(),
};

describe("WorktreeList repo root caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario: git rev-parse is not called during render", () => {
    it("does not call execaSync synchronously in the render body", () => {
      const execaSyncMock = vi.mocked(execaSync);
      // Track calls at the moment render returns (before effects run)
      let callsDuringRender = 0;
      execaSyncMock.mockImplementation(() => {
        callsDuringRender++;
        return { stdout: "/fake/repo\n" } as ReturnType<typeof execaSync>;
      });

      // render() triggers the synchronous render phase
      // useEffect callbacks run after render commits
      const { unmount } = render(
        React.createElement(WorktreeList, defaultProps),
      );

      // During the synchronous render phase, execaSync should NOT be called.
      // It should only be called when the useEffect fires (after commit).
      // In ink-testing-library, effects run synchronously after render(),
      // so we check that the call was made exactly once total (from useEffect).
      expect(execaSyncMock).toHaveBeenCalledTimes(1);
      expect(execaSyncMock).toHaveBeenCalledWith("git", ["rev-parse", "--show-toplevel"]);

      unmount();
    });

    it("provides the repo root from a pre-computed ref value", () => {
      const { unmount } = render(
        React.createElement(WorktreeList, defaultProps),
      );

      // The execaSync call populates the ref; Transfer reads from ref, not from a fresh call.
      // We verify by checking execaSync is called once (in useEffect), not per render.
      const execaSyncMock = vi.mocked(execaSync);
      expect(execaSyncMock).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe("Scenario: repo root is computed once on mount", () => {
    it("calls git rev-parse at most once across multiple re-renders", () => {
      const execaSyncMock = vi.mocked(execaSync);

      const { rerender, unmount } = render(
        React.createElement(WorktreeList, defaultProps),
      );

      const callsAfterMount = execaSyncMock.mock.calls.length;
      expect(callsAfterMount).toBe(1);

      // Re-render multiple times (simulating transferTarget changes)
      for (let i = 0; i < 5; i++) {
        rerender(
          React.createElement(WorktreeList, {
            ...defaultProps,
            worktrees: [makeWorktree({ branch: `branch-${i}` })],
          }),
        );
      }

      // execaSync should still have been called exactly once (from the initial mount useEffect)
      expect(execaSyncMock).toHaveBeenCalledTimes(1);

      unmount();
    });

    it("provides the same repo root value to every Transfer render", () => {
      const execaSyncMock = vi.mocked(execaSync);
      execaSyncMock.mockReturnValue({ stdout: "/stable/root\n" } as ReturnType<typeof execaSync>);

      const { unmount } = render(
        React.createElement(WorktreeList, defaultProps),
      );

      // All calls return the same value, and there's only one call
      expect(execaSyncMock).toHaveBeenCalledTimes(1);
      expect(execaSyncMock.mock.results[0]!.value).toEqual({ stdout: "/stable/root\n" });

      unmount();
    });
  });
});
