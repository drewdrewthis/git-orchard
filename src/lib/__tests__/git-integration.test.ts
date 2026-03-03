import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execaSync: vi.fn(),
  execa: vi.fn(),
}));

import { listWorktrees, removeWorktree } from "../git.js";
import { execaSync, execa } from "execa";

const mockedExecaSync = vi.mocked(execaSync);
const mockedExeca = vi.mocked(execa);

describe("listWorktrees", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls git rev-parse and git worktree list", () => {
    mockedExecaSync
      .mockReturnValueOnce({ stdout: "/repo" } as never) // rev-parse
      .mockReturnValueOnce({
        stdout: "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n",
      } as never); // worktree list

    const result = listWorktrees();

    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("/repo");
    expect(result[0]!.branch).toBe("main");
  });

  it("resolves main worktree path when inside .git dir", () => {
    mockedExecaSync
      .mockReturnValueOnce({ stdout: "/repo" } as never) // rev-parse
      .mockReturnValueOnce({
        stdout: "worktree /repo/.git/worktrees/main\nHEAD abc123\nbranch refs/heads/main\n",
      } as never) // worktree list
      .mockReturnValueOnce({ stdout: "/actual/repo" } as never); // core.worktree

    const result = listWorktrees();

    expect(result[0]!.path).toContain("/actual/repo");
  });
});

describe("removeWorktree", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls git worktree remove", async () => {
    mockedExeca.mockReturnValue(Promise.resolve({}) as never);

    await removeWorktree("/repo/feat");

    expect(mockedExeca).toHaveBeenCalledWith("git", ["worktree", "remove", "/repo/feat"]);
  });

  it("passes --force when force is true", async () => {
    mockedExeca.mockReturnValue(Promise.resolve({}) as never);

    await removeWorktree("/repo/feat", true);

    expect(mockedExeca).toHaveBeenCalledWith("git", ["worktree", "remove", "/repo/feat", "--force"]);
  });

  it("falls back to rm + prune when git remove fails and path is known worktree", async () => {
    // First call (git worktree remove) fails
    mockedExeca.mockReturnValueOnce(Promise.reject(new Error("locked")) as never);

    // isKnownWorktree check
    mockedExecaSync.mockReturnValueOnce({
      stdout: "worktree /repo/feat\nHEAD abc\nbranch refs/heads/feat\n",
    } as never);

    // rm -rf succeeds
    mockedExeca.mockReturnValueOnce(Promise.resolve({}) as never);
    // git worktree prune succeeds
    mockedExeca.mockReturnValueOnce(Promise.resolve({}) as never);

    await removeWorktree("/repo/feat");

    expect(mockedExeca).toHaveBeenCalledWith("rm", ["-rf", expect.stringContaining("/repo/feat")]);
    expect(mockedExeca).toHaveBeenCalledWith("git", ["worktree", "prune"]);
  });

  it("throws when fallback path is not a known worktree", async () => {
    mockedExeca.mockReturnValueOnce(Promise.reject(new Error("locked")) as never);

    // isKnownWorktree returns empty (path not found)
    mockedExecaSync.mockReturnValueOnce({ stdout: "" } as never);

    await expect(removeWorktree("/suspicious/path")).rejects.toThrow(
      "refusing to rm path not listed as a git worktree"
    );
  });
});
