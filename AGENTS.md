# Bunwright

JSON-driven browser automation CLI built on `Bun.WebView`.

## Dev Commands

```bash
bun install # install deps
bun run build        # build dist/ (banner + shebang applied)
bun test             # run tests (Bun's built-in runner)
bun run typecheck    # TypeScript check
bun run bunwright.ts --help   # run CLI directly during dev
```

## Architecture

- **Entrypoint**: `src/bunwright.ts` (CLI source)
- **Build output**: `dist/bunwright.mjs` (bundled with shebang `#!/usr/bin/env bun`)
- **Build script**: `build.ts` (defines `__VERSION__` from `package.json`)
- **Tests**: `tests/*.test.ts` (Bun's `bun:test`)
- **No monorepo**: single package, publishes from `dist/`

## CLI Usage

```bash
bunx bunwright --file instructions.json
bunx bunwright --instructions '{"steps":[...]}'
# Pass exactly one of --file or --instructions
```

## Important Quirks

- **Browser required**: `Bun.WebView` needs Chrome or WebKit installed. Set `BUN_CHROME_PATH` or use `config.backend.path` if not on PATH.
- **Retry behavior**: Failed steps retry up to 3 times. Third failure exits non-zero.
- **Success output**: JSON to **stdout** with `closingInMs: 10000` (browser stays open 10s).
- **Failure output**: JSON to **stderr** with error code (`ARGUMENT_ERROR`, `VALIDATION_ERROR`, `STEP_FAILED`).
- **Implicit run**: `bun run bunwright.ts arg` works without explicit `run` subcommand (brocli auto-wraps).
- **Config defaults**: `backend: "chrome"`, `width: 1280`, `height: 800`.

## CI

- Runs on Ubuntu only (`ubuntu-latest` in `.github/workflows/test.yml`).
- Publish workflow triggers on `v*` tags, removes `src/` and `tests/` before publishing.

## Skills

- `.agents/skills/bunwright/SKILL.md` — bunwright-specific guidance
- `.agents/skills/bun-webview/SKILL.md` — Bun.WebView API reference
- `skills-lock.json` — tracks external skill sources
