import { execa } from "execa";
import { resolvePrStatus } from "./types.js";
import type { PrInfo, PrStatus } from "./types.js";

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
    `bind-key o display-popup -E -w 80% -h 80% 'git-orchard; uid=\$(id -u); f="\${TMPDIR:-/tmp}"; f="\${f%/}/git-orchard-tmux-cmd-\$uid"; if [ -f "\$f" ]; then cmd=\$(cat "\$f"); rm -f "\$f"; eval "\$cmd"; fi'`,
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
    const status = resolvePrStatus(pr);
    const { icon, label } = tmuxStatusLabels[status];
    parts.push(`PR#${pr.number} ${icon} ${label}`);
  }

  return shellEscape(parts.join(" "));
}

const tmuxStatusLabels: Record<PrStatus, { icon: string; label: string }> = {
  failing:           { icon: "\u2717", label: "failing" },
  unresolved:        { icon: "\u25cf", label: "unresolved" },
  changes_requested: { icon: "\u25cf", label: "changes" },
  review_needed:     { icon: "\u25cb", label: "review" },
  pending_ci:        { icon: "\u25cb", label: "pending" },
  approved:          { icon: "\u2713", label: "ready" },
  merged:            { icon: "\u2713", label: "merged" },
  closed:            { icon: "\u2717", label: "closed" },
};

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
