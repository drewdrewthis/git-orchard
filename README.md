# git-orchard

Interactive TUI for managing git worktrees, PR status, tmux sessions, and more.

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![React Ink](https://img.shields.io/badge/React%20Ink-TUI-green) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **List worktrees** with branch names, PR status, review state, and tmux indicators
- **Navigate** into any worktree with Enter (cd via shell wrapper)
- **tmux integration** — attach to existing sessions or create new ones per worktree
- **PR status** from GitHub — open, merged, closed
- **Review status** — see if PRs are approved, have changes requested, or need review
- **Open PRs in browser** — jump straight to the PR on GitHub
- **Delete worktrees** with confirmation, auto-kills associated tmux sessions
- **Batch cleanup** — find and remove all worktrees with merged PRs

## Install

```bash
npm install -g git-orchard
```

## Setup

Run `git-orchard init` to get a shell wrapper function that enables `cd` and `tmux` integration:

```bash
git-orchard init
```

Add the printed function to your `~/.zshrc` or `~/.bashrc`, then reload:

```bash
source ~/.zshrc
```

This creates an `orchard` command that wraps `git-orchard`. Always use `orchard` (not `git-orchard` directly) so that cd and tmux work.

## Usage

From any git repository with worktrees:

```bash
orchard
```

### Keybindings

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate worktrees |
| `Enter` | cd into selected worktree |
| `t` | tmux into worktree (attach or create session) |
| `o` | Open PR in browser |
| `d` | Delete selected worktree |
| `c` | Cleanup worktrees with merged PRs |
| `r` | Refresh list |
| `q` | Quit |

### Commands

```bash
orchard              # Interactive worktree list
orchard cleanup      # Jump to cleanup view
orchard init         # Print shell wrapper function
orchard --help       # Show help
```

### What it looks like

```
╭────────────────────────────────────────╮
│       *        *        *              │
│      ***      ***      ***             │
│     *****    *****    *****            │
│    *******  *******  *******           │
│       |        |        |              │
│       |        |        |              │
│                                        │
│       g i t   o r c h a r d           │
╰────────────────────────────────────────╯

╭────────────────────────────────────────────────────────────╮
│  > ~/proj-feat    feat/login   ● open ✓ approved           │
│    ~/proj-fix     fix/typo     ● open ✎ changes requested  │
│    ~/proj-search  feat/search  ✓ merged  ◼ tmux:search     │
│    ~/proj-main    main         no PR     ▶ tmux:main       │
╰────────────────────────────────────────────────────────────╯

  enter cd │ t tmux │ o pr │ d delete │ c cleanup │ r refresh │ q quit
```

## Contributing

1. Fork the repo and create a feature branch
2. Read [CODEBASE_STANDARDS.md](./CODEBASE_STANDARDS.md) — we follow SOLID, KISS, YAGNI, and CUPID principles
3. Write tests for pure functions (BetterSpecs style)
4. Run `pnpm test` and make sure everything passes
5. Open a PR

```bash
pnpm install
pnpm dev          # Run in dev mode
pnpm test         # Run tests
pnpm build        # Compile TypeScript
```

## Requirements

- Node.js 18+
- Git
- [GitHub CLI](https://cli.github.com/) (`gh`) — for PR and review status (optional, works without it)
- tmux — for session detection and management (optional, works without it)

## License

MIT
