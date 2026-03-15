export function getShellFunction(): string {
  return `# git-orchard - git worktree manager
orchard() {
  case "$1" in
    init|upgrade|--json|--help|-h) git-orchard "$@"; return ;;
  esac
  for arg in "$@"; do
    case "$arg" in
      --json|--help|-h) git-orchard "$@"; return ;;
    esac
  done

  local session="orchard"
  local cmd='while true; do git-orchard "$@"; done'

  if ! tmux has-session -t "$session" 2>/dev/null; then
    local cheatsheet='#[fg=colour8]prefix: ctrl-b | o: orchard | (/): prev/next | %%: split-v | ": split-h | arrows: pane | z: zoom | x: close | d: detach'
    local status_left='#[fg=colour2,bold] orchard #[fg=colour248,nobold]'
    tmux new-session -d -s "$session" /bin/zsh -c "$cmd"
    tmux set-option -t "$session" status on
    tmux set-option -t "$session" status-style 'bg=colour235,fg=colour248'
    tmux set-option -t "$session" status-left-length 60
    tmux set-option -t "$session" status-right-length 120
    tmux set-option -t "$session" status-left "$status_left"
    tmux set-option -t "$session" status-right "$cheatsheet"

    # NOTE: This keybinding save/hook logic is intentionally duplicated in src/lib/tmux.ts
    # (saveAndHookKeybinding). They run in different execution contexts (shell vs Node)
    # and cannot share code. Keep them in sync when changing the hook format.

    # Save the current "o" keybinding before overwriting (only on first session creation)
    local _orchard_prev_bind
    _orchard_prev_bind=$(tmux list-keys 2>/dev/null | grep -E '\\bbind-key\\s+(-T\\s+prefix\\s+)?o\\b' | head -1 || true)

    # Set up cleanup hook to restore/unbind when the orchard session is destroyed.
    # Uses array index [99] to avoid overwriting user hooks at lower indices (tmux 3.2+).
    if [ -n "$_orchard_prev_bind" ]; then
      # Extract the command portion after "bind-key ... o "
      local _orchard_restore_cmd
      _orchard_restore_cmd=$(echo "$_orchard_prev_bind" | sed 's/.*bind-key \(-T [^ ]* \)\{0,1\}o //')
      tmux set-hook -g session-closed[99] "if-shell '! tmux has-session -t orchard 2>/dev/null' 'bind-key o $_orchard_restore_cmd; set-hook -gu session-closed[99]'"
    else
      tmux set-hook -g session-closed[99] "if-shell '! tmux has-session -t orchard 2>/dev/null' 'unbind-key o; set-hook -gu session-closed[99]'"
    fi
  fi

  tmux bind-key o switch-client -t orchard

  if [ -n "$TMUX" ]; then
    tmux switch-client -t "$session"
  else
    tmux attach-session -t "$session"
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

This creates an "orchard" command that launches git-orchard in a persistent tmux session.`;
}
