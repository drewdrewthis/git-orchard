import { describe, it, expect } from "vitest";
import { getShellFunction, getInitInstructions } from "../shell.js";

describe("getShellFunction", () => {
  const fn = getShellFunction();

  it("checks for the orchard tmux session", () => {
    expect(fn).toContain('tmux has-session -t "$session"');
  });

  it("does not contain CD_TARGET_FILE logic", () => {
    expect(fn).not.toContain("CD_TARGET_FILE");
  });

  it("does not contain git-orchard-cd-target", () => {
    expect(fn).not.toContain("git-orchard-cd-target");
  });

  it("does not contain git-orchard-tmux-cmd", () => {
    expect(fn).not.toContain("git-orchard-tmux-cmd");
  });

  it("uses switch-client when inside tmux", () => {
    expect(fn).toContain("tmux switch-client -t");
  });

  it("guards switch-client with a check on the TMUX environment variable", () => {
    const lines = fn.split("\n");
    const switchLine = lines.findIndex((l: string) =>
      l.includes("tmux switch-client -t")
    );
    // The line before switch-client (or a nearby ancestor) should check $TMUX
    const precedingLines = lines.slice(0, switchLine).join("\n");
    expect(precedingLines).toContain('[ -n "$TMUX" ]');
  });

  it("uses attach-session when outside tmux", () => {
    expect(fn).toContain("tmux attach-session -t");
  });

  it("includes a restart loop that re-executes git-orchard on exit", () => {
    expect(fn).toContain('while true; do git-orchard "$@"; done');
  });

  it("contains a passthrough case statement for non-interactive subcommands", () => {
    expect(fn).toContain("case");
    expect(fn).toContain('git-orchard "$@"');
  });

  it("bypasses tmux for the --json flag", () => {
    expect(fn).toContain("--json");
  });

  it("bypasses tmux for init and upgrade subcommands", () => {
    expect(fn).toContain("init");
    expect(fn).toContain("upgrade");
  });

  it("bypasses tmux for --help and -h flags", () => {
    expect(fn).toContain("--help");
    expect(fn).toContain("-h");
  });

  it("creates session named orchard", () => {
    expect(fn).toContain('local session="orchard"');
  });

  it("creates detached session when inside tmux and session does not exist", () => {
    expect(fn).toContain('tmux new-session -d -s "$session"');
  });

  describe("keybinding lifecycle", () => {
    it("queries the current 'o' key binding before overwriting", () => {
      expect(fn).toContain("tmux list-keys");
      // The list-keys query appears before bind-key o
      const listKeysIdx = fn.indexOf("tmux list-keys");
      const bindKeyIdx = fn.indexOf("bind-key o switch-client -t orchard");
      expect(listKeysIdx).toBeLessThan(bindKeyIdx);
    });

    it("stores the original binding before calling bind-key o", () => {
      expect(fn).toContain("_orchard_prev_bind");
      const storeIdx = fn.indexOf("_orchard_prev_bind=");
      const bindKeyIdx = fn.indexOf("bind-key o switch-client -t orchard");
      expect(storeIdx).toBeLessThan(bindKeyIdx);
    });

    it("sets bind-key o switch-client -t orchard", () => {
      expect(fn).toContain("bind-key o switch-client -t orchard");
    });

    it("registers a cleanup mechanism triggered on session destroy", () => {
      expect(fn).toContain("set-hook -g session-closed");
      expect(fn).toContain("has-session -t orchard");
    });

    it("cleanup restores the original binding when one existed", () => {
      // When _orchard_prev_bind is non-empty, the hook runs bind-key o <original>
      expect(fn).toContain("bind-key o $_orchard_restore_cmd");
    });

    it("cleanup unbinds when no original binding existed", () => {
      expect(fn).toContain("unbind-key o");
    });

    it("only saves original binding on first session creation (idempotent)", () => {
      // The save/hook logic is inside the "if ! tmux has-session" block.
      // Verify that list-keys appears between the opening of that block and its closing fi.
      const hasSessionMatch = fn.match(/if ! tmux has-session/);
      expect(hasSessionMatch).not.toBeNull();
      const blockStart = hasSessionMatch!.index!;

      // Find the closing fi using a regex that matches "fi" on its own line
      const afterBlock = fn.slice(blockStart);
      const fiMatch = afterBlock.match(/\bfi\b/);
      expect(fiMatch).not.toBeNull();
      const blockEnd = blockStart + fiMatch!.index!;

      const listKeysIdx = fn.indexOf("tmux list-keys");
      expect(listKeysIdx).toBeGreaterThan(blockStart);
      expect(listKeysIdx).toBeLessThan(blockEnd);
    });

    it("removes the hook itself during cleanup to avoid stale hooks", () => {
      expect(fn).toContain("set-hook -gu session-closed");
    });
  });
});

describe("getInitInstructions", () => {
  it("includes the shell function", () => {
    const instructions = getInitInstructions();
    expect(instructions).toContain("orchard()");
  });

  it("references the correct rc file for zsh", () => {
    const original = process.env.SHELL;
    process.env.SHELL = "/bin/zsh";
    const instructions = getInitInstructions();
    expect(instructions).toContain("~/.zshrc");
    process.env.SHELL = original;
  });

  it("mentions persistent tmux session in the description", () => {
    const instructions = getInitInstructions();
    expect(instructions).toContain("persistent tmux session");
  });
});
