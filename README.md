# git-forest

Interactive TUI for managing git worktrees, PR status, and tmux sessions.

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![React Ink](https://img.shields.io/badge/React%20Ink-TUI-green) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **List worktrees** with branch names, PR status, and tmux session indicators
- **Navigate** into any worktree with Enter (cd via shell wrapper)
- **PR status** from GitHub — see which PRs are open, merged, or closed
- **tmux detection** — shows active tmux sessions associated with worktrees
- **Delete worktrees** with confirmation, auto-kills associated tmux sessions
- **Batch cleanup** — find and remove all worktrees with merged PRs

## Install

```bash
npm install -g git-forest
```

## Setup

Run `git-forest init` to get a shell wrapper function that enables `cd` on worktree selection:

```bash
git-forest init
```

Add the printed function to your `~/.zshrc` or `~/.bashrc`, then reload:

```bash
source ~/.zshrc
```

This creates a `forest` command that wraps `git-forest`.

## Usage

From any git repository with worktrees:

```bash
forest
```

### Keybindings

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate worktrees |
| `Enter` | cd into selected worktree |
| `d` | Delete selected worktree |
| `c` | Cleanup worktrees with merged PRs |
| `r` | Refresh list |
| `q` | Quit |

### Commands

```bash
forest              # Interactive worktree list
forest cleanup      # Jump to cleanup view
forest init         # Print shell wrapper function
forest --help       # Show help
```

### What it looks like

```
forest
↑/↓ navigate  enter cd  d delete  c cleanup  r refresh  q quit

▸ ~/project              main        (bare)
  ~/project-feat-login   feat/login  ● open   ▶ tmux:feat-login
  ~/project-feat-search  feat/search ✓ merged ◼ tmux:feat-search
  ~/project-fix-typo     fix/typo    no PR
```

## Requirements

- Node.js 18+
- Git
- [GitHub CLI](https://cli.github.com/) (`gh`) — for PR status (optional, works without it)
- tmux — for session detection (optional, works without it)

## License

MIT
