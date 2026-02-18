# Codebase Standards

## Principles

- **SOLID** — Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- **KISS** — Keep it simple. Prefer clarity over cleverness
- **YAGNI** — Don't build it until you need it
- **CUPID** — Composable, Unix-philosophy, predictable, idiomatic, domain-based

## Testing

- All pure functions must have tests
- Follow [BetterSpecs](https://www.betterspecs.org/) conventions — descriptive names, one expectation per test, no logic in tests
- Run `pnpm test` before submitting PRs
