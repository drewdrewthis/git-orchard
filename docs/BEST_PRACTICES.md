# Best Practices

## Naming

- **No abbreviations.** Use full, descriptive names everywhere — variables, parameters, functions, files.
  - `worktree` not `wt`
  - `session` not `sess`
  - `index` not `idx`
- Variable names reveal intent. If a name needs a comment, rename it.

## Code Style

- Follow the conventions in the existing codebase. When in doubt, match what's already there.
- One concept per function. If a function does two things, split it.
- Prefer `const` over `let`. Never use `var`.
- No `any` in TypeScript — use proper types or `unknown` with narrowing.

## Error Handling

- External boundaries (git, gh, tmux) should catch and handle errors gracefully.
- Internal code can trust its own types — don't add redundant validation between trusted modules.
- Log errors via `log.error()` / `log.warn()` before swallowing them.

## Testing

- Every change ships with tests.
- Test behavior, not implementation.
- One expectation per test.
- Use factories (e.g., `makeWorktree()`) for test data.
- See [BetterSpecs](https://www.betterspecs.org/) for guidelines.

## Logging

- Use the `log` module (`src/lib/log.ts`) for debug output — never `console.log` or `console.error` in library code.
- Add `log.time` / `log.timeEnd` around operations that call external tools.
- Add `log.info` at operation boundaries (entering a mode, completing a batch).
- See [ADR-002](adr/002-debug-logging.md) for the full logging decision.
