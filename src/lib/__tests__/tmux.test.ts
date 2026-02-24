import { describe, it, expect } from "vitest";
import {
  findSessionForWorktree,
  getTmuxCommand,
  formatStatusLeft,
  type TmuxSession,
} from "../tmux.js";
import type { PrInfo } from "../types.js";

const sessions: TmuxSession[] = [
  { name: "main", path: "/home/user/project", attached: true },
  { name: "feat-login", path: "/home/user/project-login", attached: false },
  { name: "fix-typo", path: "/tmp/other", attached: false },
];

describe("findSessionForWorktree", () => {
  it("matches by session path", () => {
    const result = findSessionForWorktree(
      sessions,
      "/home/user/project",
      "main"
    );
    expect(result).toMatchObject({ name: "main", attached: true });
  });

  it("matches by directory name when path doesn't match", () => {
    const result = findSessionForWorktree(
      sessions,
      "/some/other/path/feat-login",
      "something-else"
    );
    expect(result).toMatchObject({ name: "feat-login" });
  });

  it("matches by branch name", () => {
    const result = findSessionForWorktree(
      sessions,
      "/completely/different/path",
      "fix-typo"
    );
    expect(result).toMatchObject({ name: "fix-typo" });
  });

  it("matches branch with slashes converted to dashes", () => {
    const sessionsWithSlash: TmuxSession[] = [
      { name: "feat-login", path: "/tmp/x", attached: false },
    ];
    const result = findSessionForWorktree(
      sessionsWithSlash,
      "/some/path",
      "feat/login"
    );
    expect(result).toMatchObject({ name: "feat-login" });
  });

  it("returns null when no match", () => {
    const result = findSessionForWorktree(
      sessions,
      "/no/match/here",
      "nonexistent-branch"
    );
    expect(result).toBeNull();
  });

  it("returns null for empty sessions list", () => {
    const result = findSessionForWorktree([], "/some/path", "main");
    expect(result).toBeNull();
  });

  it("returns null when branch is null and no path/dir match", () => {
    const result = findSessionForWorktree(
      sessions,
      "/no/match",
      null
    );
    expect(result).toBeNull();
  });

  it("prefers path match over name match", () => {
    const ambiguous: TmuxSession[] = [
      { name: "project", path: "/wrong/path", attached: false },
      { name: "other", path: "/home/user/project", attached: true },
    ];
    const result = findSessionForWorktree(
      ambiguous,
      "/home/user/project",
      "something"
    );
    expect(result).toMatchObject({ name: "other", attached: true });
  });
});

const openPr: PrInfo = {
  number: 42,
  state: "open",
  title: "Add login",
  url: "https://github.com/org/repo/pull/42",
  reviewDecision: "",
  unresolvedThreads: 0,
};

describe("getTmuxCommand", () => {
  it("returns attach command for existing session", () => {
    const cmd = getTmuxCommand({
      worktreePath: "/tmp/wt",
      sessionName: "feat-login",
      existingSession: "feat-login",
      branch: "feat/login",
      pr: openPr,
    });
    expect(cmd).toBe("tmux attach-session -t 'feat-login'");
  });

  it("includes status bar options for new session", () => {
    const cmd = getTmuxCommand({
      worktreePath: "/tmp/wt",
      sessionName: "feat-login",
      existingSession: null,
      branch: "feat/login",
      pr: null,
    });
    expect(cmd).toContain("tmux new-session -s 'feat-login' -c '/tmp/wt'");
    expect(cmd).toContain("set-option status on");
    expect(cmd).toContain("set-option status-style");
    expect(cmd).toContain("set-option status-left");
    expect(cmd).toContain("set-option status-right");
  });

  it("includes popup keybinding for new session", () => {
    const cmd = getTmuxCommand({
      worktreePath: "/tmp/wt",
      sessionName: "main",
      existingSession: null,
      branch: "main",
      pr: null,
    });
    expect(cmd).toContain("bind-key o display-popup -E -w 80% -h 80% 'git-orchard'");
  });

  it("includes PR info in status left when PR exists", () => {
    const cmd = getTmuxCommand({
      worktreePath: "/tmp/wt",
      sessionName: "feat-login",
      existingSession: null,
      branch: "feat/login",
      pr: openPr,
    });
    expect(cmd).toContain("PR#42");
    expect(cmd).toContain("open");
  });

  it("includes detach hint in status right", () => {
    const cmd = getTmuxCommand({
      worktreePath: "/tmp/wt",
      sessionName: "main",
      existingSession: null,
      branch: "main",
      pr: null,
    });
    expect(cmd).toContain("^B d detach");
    expect(cmd).toContain("^B o orchard");
  });
});

describe("formatStatusLeft", () => {
  it("shows branch name without PR", () => {
    const result = formatStatusLeft("feat/login", null);
    expect(result).toContain("feat/login");
    expect(result).not.toContain("PR#");
  });

  it("shows detached when branch is null", () => {
    const result = formatStatusLeft(null, null);
    expect(result).toContain("detached");
  });

  it("shows open PR with bullet icon", () => {
    const result = formatStatusLeft("feat/login", openPr);
    expect(result).toContain("PR#42");
    expect(result).toContain("\u25cf open");
  });

  it("shows merged PR with check icon", () => {
    const mergedPr: PrInfo = { ...openPr, state: "merged" };
    const result = formatStatusLeft("feat/login", mergedPr);
    expect(result).toContain("\u2713 merged");
  });

  it("shows closed PR with cross icon", () => {
    const closedPr: PrInfo = { ...openPr, state: "closed" };
    const result = formatStatusLeft("feat/login", closedPr);
    expect(result).toContain("\u2717 closed");
  });
});
