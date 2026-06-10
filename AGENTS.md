# CLAUDE.md

This file provides guidance to AI agents when working with code in this repository.

## What This Is

Bunwright is a TypeScript-first browser automation DSL built on `Bun.WebView` — a lightweight Playwright alternative for Bun. Users write automation scripts importing `browser` from `bunwright`; the CLI (`bunwright <script.ts>`) loads `.env`/`.env.local`, imports the script, and runs its default export.

## Commands

```bash
bun install              # install deps
bun test                 # all tests (bun:test runner)
bun test tests/dsl.test.ts          # single test file
bun test -t "name"       # filter by test name
bun run typecheck        # tsc --noEmit
bun run lint             # oxlint
bun run lint:fix
bun run format           # oxfmt
bun run build            # bundles dist/ (build.ts) + emits .d.ts
bun run docs             # build + regenerate docs/api-reference.md (auto-generated, never hand-edit)
bun run src/bunwright.ts examples/login.ts   # run CLI directly in dev
```

CI (`.github/workflows/test.yml`) runs typecheck + tests on `ubuntu-latest` only. Publish triggers on `v*` tags and strips `src/`/`tests/` before publishing; package publishes from `dist/` (bin: `dist/bunwright.mjs`, module: `dist/index.mjs`).

## Architecture

Single package, no runtime dependencies. Two entrypoints bundled by `build.ts`:

- `src/bunwright.ts` — CLI: env loading, then dynamic-imports the user script.
- `src/dsl/index.ts` — library public API: `browser` (singleton), `defineConfig`, `Locator`, `ElementHandle`, error classes, types.

### DSL core (`src/dsl/`)

- `chain.ts` — lazy chain proxy. `chainable(obj)` returns a non-thenable "resting" proxy; method calls start a "pending" chain (a thenable queue). Steps execute sequentially; a failed step skips the rest and rejects with the original error; `.all()` resolves with every step's result in order. Awaiting resolves to the final target, or the value if the last step returned one. Classes opt in via the `CHAINABLE` symbol marker (avoids circular imports). Method generics are erased by the mapped `Chain<T>` type, so `evaluate` has an explicit override to keep inference.
- `browser.ts` — the heart. `BunwrightBrowser` singleton lazily creates one shared `Bun.WebView` on first `newContext()`/`newPage()` (pages/contexts are returned `chainable(...)`-wrapped). `BrowserContext` and `Page` both wrap that single WebView (contexts/pages are not isolated browser instances). `Page` methods return `Promise<this>`, auto-wait for visible+enabled, and retry up to 3 attempts with exponential backoff within `retryTimeout` (default 10s). DOM interaction happens by injecting JS strings via `webview.evaluate()`; `Bun.WebView` rejects concurrent evaluates, so they are serialized per view (`serializeEvaluate`). `waitForURL` treats strings as anchored URL globs (`globToRegex`).
- `selectors.ts` — `Selector` is a prefixed template string: `role:`, `label:`, `text:`, `css:`, `xpath:`. `SelectorResolver.resolve()` is async (runs JS in the page) and caches per-WebView. `role:` supports implicit roles (`button` → `<button>`, `input[type=submit]`, …) with `[name='...']` matched against aria-label/value/text. Unprefixed strings pass through as CSS.
- `config.ts` — config resolution order: defaults ← `bunwright.config.{ts,js,mjs}` in cwd ← `defineConfig()` call. Defaults: chrome backend, 1280×800, headless only on Windows.
- `chrome-spawn.ts` — Windows workaround (see below).
- `locator.ts` — Playwright-style `Locator` / `ElementHandle`. `Page.locator()` uses `require()` to avoid a circular import with `browser.ts`.
- `errors.ts` — `BunwrightError` base; `SelectorError`, `TimeoutError`, `ElementNotFoundError`, `BrowserError`.

### Windows Chrome workaround

`Bun.WebView`'s built-in Chrome spawn fails on win32. On Windows + chrome backend, `browser.ts` instead calls `spawnChrome()`: finds a free port, launches Chrome with `--remote-debugging-port`, polls `/json/version` for `webSocketDebuggerUrl`, and passes that URL as the WebView backend. In this mode `backend.path`/`backend.argv` are ignored. Chrome executable resolution: `BUN_CHROME_PATH` env → `config.backend.path` → common Windows install paths. Spawned Chrome is killed on `browser.close()` and process exit. `BUNWRIGHT_DEBUG=1` logs the spawned port.

## Environment Notes

- Requires a real Chrome/WebKit install; integration tests need it. Unit tests (`chrome-spawn.test.ts`, `dsl.test.ts`) run without a browser session where possible.
- `examples/*.ts` are runnable end-to-end demos of the DSL surface. `tsconfig.json` maps the `bunwright` package name to `src/dsl/index.ts`, so `bun run typecheck` covers the examples too.
- `.agents/skills/bun-webview/SKILL.md` documents the `Bun.WebView` API; `.agents/skills/bunwright/SKILL.md` has project-specific guidance.
