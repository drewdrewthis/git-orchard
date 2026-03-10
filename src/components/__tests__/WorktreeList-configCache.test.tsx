import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { OrchardConfig } from "../../lib/config.js";
import type { Worktree } from "../../lib/types.js";

// --- Mocks ---

const mockLoadConfig = vi.fn<() => OrchardConfig>();

vi.mock("../../lib/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...(args as [])),
}));

vi.mock("../../lib/tmux.js", () => ({
  switchToSession: vi.fn().mockResolvedValue(undefined),
  deriveSessionName: vi.fn().mockReturnValue("test-session"),
  capturePaneContent: vi.fn().mockReturnValue({ promise: Promise.resolve(""), kill: vi.fn() }),
}));

vi.mock("../../lib/browser.js", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../lib/navigation.js", () => ({
  cursorIndexFromDigit: vi.fn().mockReturnValue(null),
}));

vi.mock("../../lib/remote.js", () => ({
  attachRemoteSession: vi.fn().mockResolvedValue(undefined),
  createRemoteSession: vi.fn().mockResolvedValue(undefined),
  captureRemotePaneContent: vi.fn().mockReturnValue({ promise: Promise.resolve(""), kill: vi.fn() }),
}));

vi.mock("../../lib/log.js", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), time: vi.fn(), timeEnd: vi.fn() },
}));

vi.mock("execa", () => ({
  execaSync: vi.fn().mockReturnValue({ stdout: "/tmp/repo" }),
}));

vi.mock("ink-spinner", () => ({
  default: () => React.createElement("span", null, "..."),
}));

vi.mock("@mishieck/ink-titled-box", () => ({
  TitledBox: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("div", props, children as React.ReactNode),
}));

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

const defaultConfig: OrchardConfig = {
  remote: { host: "ubuntu@10.0.3.56", repoPath: "/home/ubuntu/repo" },
};

describe("WorktreeList config caching", () => {
  let WorktreeList: typeof import("../WorktreeList.js").WorktreeList;

  beforeEach(async () => {
    vi.resetModules();
    mockLoadConfig.mockClear();
    mockLoadConfig.mockReturnValue(defaultConfig);
    // Re-import to get fresh module with reset mocks
    const mod = await import("../WorktreeList.js");
    WorktreeList = mod.WorktreeList;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Scenario: loadConfig result is cached after initial load", () => {
    it("calls loadConfig at most once across multiple re-renders", () => {
      const worktrees = [makeWorktree(), makeWorktree({ path: "/other", branch: "feat" })];
      const onRefresh = vi.fn();
      const onCleanup = vi.fn();

      const props = {
        worktrees,
        loading: false,
        error: null,
        onRefresh,
        onCleanup,
      };

      const { rerender, unmount } = render(
        React.createElement(WorktreeList, props),
      );

      const callCountAfterMount = mockLoadConfig.mock.calls.length;
      expect(callCountAfterMount).toBe(1);

      // Re-render 10 times (simulating cursor navigation triggers)
      for (let i = 0; i < 10; i++) {
        rerender(React.createElement(WorktreeList, props));
      }

      // loadConfig should not have been called again
      expect(mockLoadConfig.mock.calls.length).toBe(callCountAfterMount);

      unmount();
    });

    it("returns the same config object reference on each access", () => {
      const worktrees = [makeWorktree()];
      const { rerender, unmount } = render(
        React.createElement(WorktreeList, {
          worktrees,
          loading: false,
          error: null,
          onRefresh: vi.fn(),
          onCleanup: vi.fn(),
        }),
      );

      // The mock was called once and should return the same object
      expect(mockLoadConfig).toHaveBeenCalledTimes(1);

      // Re-render — still no extra calls
      rerender(
        React.createElement(WorktreeList, {
          worktrees,
          loading: false,
          error: null,
          onRefresh: vi.fn(),
          onCleanup: vi.fn(),
        }),
      );

      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  describe("Scenario: cached config is used inside useInput handler", () => {
    it("does not call loadConfig when pressing 't' on a remote worktree", async () => {
      const remoteWorktree = makeWorktree({
        remote: "ubuntu@10.0.3.56",
        tmuxSession: "remote-sess",
      });

      const { stdin, unmount } = render(
        React.createElement(WorktreeList, {
          worktrees: [remoteWorktree],
          loading: false,
          error: null,
          onRefresh: vi.fn(),
          onCleanup: vi.fn(),
        }),
      );

      const callCountBeforeInput = mockLoadConfig.mock.calls.length;
      expect(callCountBeforeInput).toBe(1); // Only the initial mount call

      // Simulate pressing "t" to attach to remote session
      stdin.write("t");

      // Allow microtasks to flush
      await new Promise((r) => setTimeout(r, 50));

      // loadConfig should NOT have been called again
      expect(mockLoadConfig.mock.calls.length).toBe(callCountBeforeInput);

      unmount();
    });
  });

  describe("Scenario: config cache is invalidated on manual refresh", () => {
    it("re-reads config from disk when user presses 'r'", async () => {
      const worktrees = [makeWorktree()];
      const onRefresh = vi.fn();

      const { stdin, unmount } = render(
        React.createElement(WorktreeList, {
          worktrees,
          loading: false,
          error: null,
          onRefresh,
          onCleanup: vi.fn(),
        }),
      );

      expect(mockLoadConfig).toHaveBeenCalledTimes(1);

      // Simulate config change on disk by returning new values
      const updatedConfig: OrchardConfig = {
        remote: { host: "newhost@10.0.0.1", repoPath: "/new/repo" },
      };
      mockLoadConfig.mockReturnValue(updatedConfig);

      // Press "r" to refresh
      stdin.write("r");

      await new Promise((r) => setTimeout(r, 50));

      // loadConfig should have been called again
      expect(mockLoadConfig).toHaveBeenCalledTimes(2);
      // onRefresh should also have been called
      expect(onRefresh).toHaveBeenCalledTimes(1);

      unmount();
    });

    it("uses new config values after refresh invalidation", async () => {
      const remoteWorktree = makeWorktree({
        remote: "ubuntu@10.0.3.56",
        tmuxSession: "remote-sess",
      });
      const onRefresh = vi.fn();

      const { stdin, unmount } = render(
        React.createElement(WorktreeList, {
          worktrees: [remoteWorktree],
          loading: false,
          error: null,
          onRefresh,
          onCleanup: vi.fn(),
        }),
      );

      // Update config to new values
      const updatedConfig: OrchardConfig = {
        remote: { host: "newhost@10.0.0.1", repoPath: "/new/repo", shell: "mosh" },
      };
      mockLoadConfig.mockReturnValue(updatedConfig);

      // Press "r" to refresh, then "t" to trigger remote attach
      stdin.write("r");
      await new Promise((r) => setTimeout(r, 50));

      // Verify config was re-read
      expect(mockLoadConfig).toHaveBeenCalledTimes(2);

      // Now press "t" — it should use the updated config from the ref
      stdin.write("t");
      await new Promise((r) => setTimeout(r, 50));

      // loadConfig should NOT be called again for the "t" press
      expect(mockLoadConfig).toHaveBeenCalledTimes(2);

      // Verify the remote module was called with the new host
      const { attachRemoteSession } = await import("../../lib/remote.js");
      expect(attachRemoteSession).toHaveBeenCalledWith(
        "newhost@10.0.0.1",
        expect.any(String),
        "mosh",
      );

      unmount();
    });
  });
});
