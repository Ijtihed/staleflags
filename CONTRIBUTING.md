# Contributing to staleflags

Thanks for wanting to help. staleflags is a small, focused tool and contributions are welcome.

## Setup

```bash
git clone https://github.com/Ijtihed/staleflags.git
cd staleflags
npm install
npm run build
npm test
```

This is a Turborepo monorepo with three packages:

| Package | Path | Description |
|---------|------|-------------|
| `@staleflags/core` | `packages/core` | Scanner engine, flag discovery, environment comparison, dead code analysis |
| `staleflags` | `packages/cli` | CLI wrapper — parses args, calls core, formats output |
| `@staleflags/action` | `packages/action` | GitHub Action wrapper |

## Development

```bash
npm run dev          # watch mode for all packages
npm run build        # build everything
npm test             # run all tests
```

To test the CLI locally:

```bash
node packages/cli/dist/bin.js --path /path/to/some/project
```

## Tests

Tests live in `packages/core/test/` and use Vitest.

```bash
cd packages/core
npx vitest run          # run once
npx vitest              # watch mode
```

Add tests for any new detection logic. Test fixtures go in `packages/core/test/fixtures/`.

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build && npm test` and make sure everything passes
4. Open a PR with a clear description of what changed and why

Keep PRs small and focused. One feature or fix per PR.

## What to work on

- Bug fixes are always welcome
- New flag detection patterns (more languages, more config formats)
- Better dead code quantification
- Performance improvements
- Documentation improvements

If you want to work on something large, open an issue first so we can discuss the approach.

## Code style

- TypeScript, ESM, strict mode
- No runtime dependencies in core unless absolutely necessary
- Tests for every detection path

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
