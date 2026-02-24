# Architecture Decision Records (ADRs)

Document **important technical and architectural decisions** — context, trade-offs, and consequences.

## Decisions

| # | Decision | Status |
|---|----------|--------|
| [001](./001-shell-wrapper-ipc.md) | Shell wrapper with temp file IPC for cd/tmux | Accepted |

## When to Write an ADR

- Long-lasting or hard to reverse
- Affects the overall architecture or user-facing behavior
- Tools, frameworks, data models, protocols, patterns
- Impacts maintainability or the contribution experience

Skip for small implementation details or experiments.

## How to Write

1. **One decision per ADR** — keep it focused
2. **Keep it short** — 1-2 pages max
3. **Write for the future** — assume someone reads this in 2 years
4. **Be honest about trade-offs** — no decision is perfect
5. **Use narrative** — explain reasoning, not just bullet points

Use [`TEMPLATE.md`](./TEMPLATE.md) for new ADRs. Name: `NNN-short-title.md`

## Status

- **Draft** → initial write-up
- **Proposed** → under discussion
- **Accepted** → in effect
- **Superseded** → replaced by later ADR
- **Deprecated** → no longer relevant
