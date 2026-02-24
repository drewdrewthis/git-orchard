import { execa } from "execa";
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

    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, path, attached] = line.split("\t");
        return { name: name!, path: path!, attached: attached === "1" };
      });
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

  // Match by session name containing the branch name or last dir segment
  const dirName = worktreePath.split("/").pop() || "";
  const byName = sessions.find(
    (s) =>
      s.name === dirName ||
      (branch && s.name === branch) ||
      (branch && s.name === branch.replace(/\//g, "-"))
  );
  return byName || null;
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  await execa("tmux", ["kill-session", "-t", sessionName]);
}

export interface TmuxCommandOptions {
  worktreePath: string;
  sessionName: string;
  existingSession: string | null;
  branch: string | null;
  pr: PrInfo | null;
}

export function getTmuxCommand(opts: TmuxCommandOptions): string {
  const { worktreePath, sessionName, existingSession, branch, pr } = opts;

  if (existingSession) {
    return `tmux attach-session -t ${shellEscape(existingSession)}`;
  }

  const statusLeft = formatStatusLeft(branch, pr);
  const statusRight = "'#[fg=colour8]^B d detach  ^B o orchard'";

  const setOptions = [
    `set-option status on`,
    `set-option status-style 'bg=colour235,fg=colour248'`,
    `set-option status-left-length 60`,
    `set-option status-right-length 40`,
    `set-option status-left ${statusLeft}`,
    `set-option status-right ${statusRight}`,
    `bind-key o display-popup -E -w 80% -h 80% 'git-orchard'`,
  ];

  const escapedName = shellEscape(sessionName);
  const escapedPath = shellEscape(worktreePath);
  const setOptionsCmds = setOptions.map((cmd) => `\\; ${cmd}`).join(" ");

  return `tmux new-session -s ${escapedName} -c ${escapedPath} ${setOptionsCmds}`;
}

export function formatStatusLeft(
  branch: string | null,
  pr: PrInfo | null
): string {
  const branchLabel = branch ?? "detached";
  const parts = [`#[fg=colour2,bold] ${branchLabel} #[fg=colour248,nobold]`];

  if (pr) {
    const stateIcon = prStateIcon(pr.state);
    parts.push(`PR#${pr.number} ${stateIcon}`);
  }

  return shellEscape(parts.join(" "));
}

function prStateIcon(state: PrInfo["state"]): string {
  switch (state) {
    case "open":
      return "\u25cf open";
    case "merged":
      return "\u2713 merged";
    case "closed":
      return "\u2717 closed";
  }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
