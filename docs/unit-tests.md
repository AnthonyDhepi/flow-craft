# Unit tests

Reranga uses **Vitest** for unit testing.

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

The current unit tests focus on the core diagram logic in `tests/unit/`:

- `diagram.test.ts` checks document sanitizing, legacy schema migration, and diagram health metrics.
- `layout.test.ts` checks auto-layout behavior and confirms nodes are repositioned correctly.
- `import.test.ts` checks the outline import parser, including successful import generation and invalid target validation.

## Notes

- The unit suite is aimed at pure logic and data transformation behavior rather than UI interaction.
- Browser interaction coverage lives separately in the Playwright end-to-end tests under `tests/e2e/`.
