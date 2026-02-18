export function getShellFunction(): string {
  return `# git-orchard - git worktree manager
orchard() {
  local uid=$(id -u)
  local tmpbase="\${TMPDIR:-/tmp}"
  tmpbase="\${tmpbase%/}"
  local cdfile="$tmpbase/git-orchard-cd-target-$uid"
  local tmuxfile="$tmpbase/git-orchard-tmux-cmd-$uid"
  command git-orchard "$@"
  local target tmuxcmd
  target=$(cat "$cdfile" 2>/dev/null)
  tmuxcmd=$(cat "$tmuxfile" 2>/dev/null)
  rm -f "$cdfile" "$tmuxfile"
  if [ -n "$tmuxcmd" ]; then
    # eval is safe: content is written by git-orchard via getTmuxCommand(),
    # file is per-UID (mode 0600), and deleted immediately after reading
    eval "$tmuxcmd"
  elif [ -n "$target" ] && [ -d "$target" ]; then
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

This creates an "orchard" command that wraps git-orchard so selecting a worktree will cd into it.`;
}
