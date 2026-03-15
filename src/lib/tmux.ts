import { execa } from "execa";
import { log } from "./log.js";
import { resolvePrStatus, prStatusDisplay } from "./types.js";
import type { PrInfo } from "./types.js";

export interface TmuxSession {
  name: string;
  path: string;
  attached: boolean;
}

export async function listTmuxSessions(): Promise<TmuxSession[]> {
  try {
    const { stdout } = await execa("tmux", [
      "list-sessions",
      "-F",
      "#{session_name}\t#{session_path}\t#{session_attached}",
    ]);

    const sessions = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, path, attached] = line.split("\t");
        return { name: name!, path: path!, attached: attached === "1" };
      });
    log.info(`listTmuxSessions: ${sessions.length} sessions`);
    return sessions;
  } catch {
    // tmux not running or not installed
    return [];
  }
}

export function findSessionForWorktree(
  sessions: TmuxSession[],
  worktreePath: string,
  branch: string | null
): TmuxSession | null {
  // Match by session working directory
  const byPath = sessions.find((s) => s.path === worktreePath);
  if (byPath) return byPath;

  // Match by session name: support "repo_branch" format and legacy bare branch/dir names
  const dirName = worktreePath.split("/").pop() || "";
  const branchSlug = branch ? branch.replace(/\//g, "-") : null;
  const byName = sessions.find((s) => {
    // Extract suffix after the last "_" (current format) or ":" (legacy format)
    const sepIdx = Math.max(s.name.lastIndexOf("_"), s.name.lastIndexOf(":"));
    const nameSuffix = sepIdx >= 0 ? s.name.slice(sepIdx + 1) : s.name;
    return (
      s.name === dirName ||
      nameSuffix === dirName ||
      (branch && s.name === branch) ||
      (branchSlug && s.name === branchSlug) ||
      (branchSlug && nameSuffix === branchSlug)
    );
  });
  return byName || null;
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  await execa("tmux", ["kill-session", "-t", sessionName]);
  log.info(`killTmuxSession: ${sessionName}`);
}

/** A capture handle that exposes both the result promise and a kill function. */
export interface CancellableCapture {
  promise: Promise<string | null>;
  kill: () => void;
}

export function capturePaneContent(sessionName: string, lines: number): CancellableCapture {
  const subprocess = execa("tmux", [
    "capture-pane", "-t", sessionName, "-p", "-J", "-e",
    "-S", String(-lines),
  ]);

  const promise = subprocess.then(
    (result) => result.stdout.trimEnd(),
    () => null,
  );

  return { promise, kill: () => subprocess.kill() };
}

/**
 * Derive a tmux session name in the format "repoName_branch" (or "repoName_dirName" for detached HEAD).
 * Uses `_` as the separator (`:` is reserved by tmux as session:window delimiter).
 */
export function deriveSessionName(
  repoName: string,
  branch: string | null,
  worktreePath: string
): string {
  const suffix = branch
    ? branch.replace(/\//g, "-")
    : worktreePath.split("/").pop() || "orchard";
  return `${repoName}_${suffix}`;
}

export interface SwitchToSessionOptions {
  sessionName: string;
  worktreePath: string;
  branch: string | null;
  pr: PrInfo | null;
}

/**
 * Switch the tmux client to a worktree session, creating it if needed.
 * Configures status bar and popup keybinding on new sessions.
 */
export async function switchToSession(
  opts: SwitchToSessionOptions,
  runner: CommandRunner = execaRunner
): Promise<void> {
  const { sessionName, worktreePath, branch, pr } = opts;

  const exists = await sessionExists(sessionName, runner);

  if (!exists) {
    await runner("tmux", ["new-session", "-d", "-s", sessionName, "-c", worktreePath]);
  }

  await applySessionStyle(sessionName, branch, pr, runner);
  await runner("tmux", ["switch-client", "-t", sessionName]);
  log.info(`switchToSession: ${sessionName} (${exists ? "existing" : "new"})`);
}

export type CommandRunner = (
  cmd: string,
  args: string[]
) => Promise<{ stdout: string }>;

async function sessionExists(
  name: string,
  runner: CommandRunner
): Promise<boolean> {
  try {
    await runner("tmux", ["has-session", "-t", name]);
    return true;
  } catch {
    return false;
  }
}

const CHEATSHEET = "#[fg=colour8]prefix: ctrl-b | o: orchard | (/): prev/next | %%: split-v | \": split-h | arrows: pane | z: zoom | x: close | d: detach";

async function applySessionStyle(
  sessionName: string,
  branch: string | null,
  pr: PrInfo | null,
  runner: CommandRunner
): Promise<void> {
  const statusLeft = formatStatusLeft(branch, pr);
  const t = ["-t", sessionName];

  // Save the current "o" keybinding and set up cleanup hook (idempotent — only if hook not already set)
  await saveAndHookKeybinding(runner);

  await Promise.all([
    runner("tmux", ["set-option", ...t, "status", "on"]),
    runner("tmux", ["set-option", ...t, "status-style", "bg=colour235,fg=colour248"]),
    runner("tmux", ["set-option", ...t, "status-left-length", "60"]),
    runner("tmux", ["set-option", ...t, "status-right-length", "150"]),
    runner("tmux", ["set-option", ...t, "status-left", statusLeft]),
    runner("tmux", ["set-option", ...t, "status-right", CHEATSHEET]),
    runner("tmux", ["bind-key", "o", "switch-client", "-t", "orchard"]),
  ]);
}

/**
 * Save the current "o" keybinding before overwriting, and register a tmux
 * session-closed hook that restores or unbinds when the orchard session is destroyed.
 *
 * Idempotent: if the hook is already set (from a prior invocation), this is a no-op
 * so we don't overwrite the saved original binding.
 *
 * NOTE: This keybinding save/hook logic is intentionally duplicated in the shell
 * function string in src/lib/shell.ts. They run in different execution contexts
 * (shell vs Node) and cannot share code. Keep them in sync when changing the hook format.
 */
export async function saveAndHookKeybinding(runner: CommandRunner): Promise<void> {
  // Check if we already set the hook (idempotency guard).
  // The [99] suffix is included in the show-hooks output so the check still works.
  try {
    const { stdout } = await runner("tmux", ["show-hooks", "-g"]);
    if (stdout.includes("session-closed") && stdout.includes("orchard")) {
      return; // Hook already registered, don't overwrite the saved original
    }
  } catch {
    // show-hooks may fail if no hooks are set — that's fine, continue
  }

  // Capture the current "o" binding
  let originalCmd: string | null = null;
  try {
    const { stdout } = await runner("tmux", ["list-keys"]);
    const match = stdout.split("\n").find(
      (line) => /\bbind-key\s+(-T\s+prefix\s+)?o\b/.test(line)
    );
    if (match) {
      // Extract command after "bind-key [-T prefix] o "
      originalCmd = match.replace(/.*bind-key\s+(?:-T\s+\S+\s+)?o\s+/, "");
    }
  } catch {
    // list-keys may fail — treat as no prior binding
  }

  // Register the session-closed hook using array index [99] to avoid colliding
  // with lower-indexed user hooks (tmux 3.2+ supports named hook arrays).
  const cleanupAction = originalCmd
    ? `bind-key o ${originalCmd}; set-hook -gu session-closed[99]`
    : `unbind-key o; set-hook -gu session-closed[99]`;

  await runner("tmux", [
    "set-hook", "-g", "session-closed[99]",
    `if-shell '! tmux has-session -t orchard 2>/dev/null' '${cleanupAction}'`,
  ]);
}

const execaRunner: CommandRunner = async (cmd, args) => {
  return execa(cmd, args);
};

export function formatStatusLeft(
  branch: string | null,
  pr: PrInfo | null
): string {
  const branchLabel = branch ?? "detached";
  const parts = [`#[fg=colour2,bold] ${branchLabel} #[fg=colour248,nobold]`];

  if (pr) {
    const status = resolvePrStatus(pr);
    const { icon, label } = prStatusDisplay[status];
    parts.push(`PR#${pr.number} ${icon} ${label}`);
  }

  return parts.join(" ");
}

