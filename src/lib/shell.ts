export const CD_TARGET_FILE = "/tmp/git-forest-cd-target";

export function getShellFunction(): string {
  return `# git-forest - git worktree manager
forest() {
  command git-forest "$@"
  local target
  target=$(cat /tmp/git-forest-cd-target 2>/dev/null)
  rm -f /tmp/git-forest-cd-target
  if [ -n "$target" ] && [ -d "$target" ]; then
    cd "$target" || return
  fi
}`;
}

export function getInitInstructions(): string {
  const shell = process.env.SHELL || "/bin/zsh";
  const rcFile = shell.includes("zsh") ? "~/.zshrc" : "~/.bashrc";

  return `Add this to your ${rcFile}:

${getShellFunction()}

Then reload your shell:
  source ${rcFile}

This creates a "forest" command that wraps git-forest so selecting a worktree will cd into it.`;
}
