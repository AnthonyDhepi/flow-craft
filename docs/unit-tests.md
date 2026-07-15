# Unit tests

FlowCraft uses **Vitest** for unit testing.

## Run the unit tests

```bash
npm run test
```

To run the broader local validation flow:

```bash
npm run check
```

That command runs linting, the unit test suite, and the production build.

## Current unit test coverage

The unit tests focus on the core logic layer in `tests/unit/`:

- `diagram.test.ts` — document sanitizing, legacy schema migration, diagram health
  metrics, and content-aware node auto-sizing.
- `layout.test.ts` — Dagre auto-layout repositions nodes correctly.
- `import.test.ts` — the outline import parser, including successful generation and
  invalid-target validation.
- `editor-store.test.ts` — the Zustand editor store's manual node-resize behavior
  (persisting dimensions, honoring the content minimum as a floor).

## Notes

- The unit suite targets pure logic and data transformation rather than UI interaction.
- Browser interaction coverage lives in the Playwright end-to-end tests under
  `tests/e2e/` (run with `npm run test:e2e`).
