# AGENTS.md

Bunwright: TypeScript-first browser-automation DSL built on `Bun.WebView` (lightweight Playwright alternative). The CLI `bunwright <script.ts>` loads `.env`/`.env.local`, imports the script, and runs its default export.

## Layout

Bun monorepo (`packageManager: bun@1.3.14`), workspaces under `packages/*`:

- `packages/app` — the `bunwright` library + CLI (publishable npm package).
- `packages/website` — Astro/Starlight docs site (Cloudflare adapter, `wrangler.jsonc`). Read `packages/website/AGENTS.md` before touching it.

## Commands

```bash
bun install                                              # workspace deps (CI: bun install --frozen-lockfile)
bun run --cwd packages/app test                          # all tests (bun:test)
bun run --cwd packages/app test tests/dsl.test.ts        # single file
bun run --cwd packages/app test -t "name"                # filter by name
bun run --cwd packages/app typecheck                     # tsc --noEmit; app is the only package with typecheck
bun run lint                                             # oxlint, repo-wide
bun run format / format:check                            # oxfmt, repo-wide
bun run --cwd packages/app build                         # bundle dist/ (build.ts) + emit .d.ts
bun run --cwd packages/app docs                          # build + regenerate docs/api-reference.md (auto-gen, never hand-edit)
bun run packages/app/src/bunwright.ts packages/app/examples/login.ts   # run CLI in dev
```

CI (`.github/workflows/test.yml`, ubuntu): typecheck → lint → format:check → build → test. Replicate that order before pushing; installs google-chrome-stable and sets `BUN_CHROME_PATH`.

Git hooks: `simple-git-hooks` pre-commit runs `lint-staged` → oxfmt on staged files. CI installs with `SKIP_INSTALL_SIMPLE_GIT_HOOKS=1`.

Publish (`.github/workflows/publish.yml`): triggers on `v*` tags; tag version must equal `packages/app/package.json` version. Uses `npm publish --provenance` (OIDC — bun publish lacks trusted publishing). `files` + `.npmignore` restrict the tarball to `dist/` + README + LICENSE, stripping `src`/`tests`/`docs`.

## Architecture

No runtime dependencies. Two entrypoints bundled by `build.ts`:

- `packages/app/src/bunwright.ts` — CLI: env loading, then dynamic-imports the user script.
- `packages/app/src/dsl/index.ts` — public API: `browser` (singleton, also the default export), `defineConfig`, `Locator`, `ElementHandle`, error classes, types.

### DSL core (`packages/app/src/dsl/`)

- `chain.ts` — lazy chain proxy. `chainable(obj)` returns a non-thenable "resting" proxy; method calls start a "pending" thenable queue. Steps run sequentially; a failed step skips the rest and rejects with the original error; `.all()` resolves with every step's result in order. Await resolves to the final target, or the value if the last step returned one. Classes opt in via the `CHAINABLE` symbol. Method generics are erased by the mapped `Chain<T>` type, so `evaluate` has an explicit override.
- `browser.ts` — the heart. Singleton lazily creates one shared `Bun.WebView` on first `newContext()`/`newPage()`; contexts/pages are **not** isolated (all wrap the same view). `Page` methods return `Promise<this>`, auto-wait for visible+enabled, retry 3× with exponential backoff within `retryTimeout` (default 10s). DOM ops inject JS strings via `webview.evaluate()`; `Bun.WebView` rejects concurrent evaluates, so they're serialized per view (`serializeEvaluate`). Lazily `require("./locator.js")` to dodge a circular import. `waitForURL` treats strings as anchored globs (`globToRegex`).
- `wait.ts` — `inPageWaitScript` runs waits inside the page (immediate + `MutationObserver` + interval) as a single evaluate round-trip, replacing host-side 50ms polling.
- `selectors.ts` — prefixed template selectors: `role:`, `label:`, `text:`, `css:`, `xpath:`. `role:` has implicit roles + `[name='...']` matched against aria-label/value/text. Unprefixed strings pass through as CSS. Resolution is async and cached per WebView.
- `config.ts` — resolution: defaults ← `bunwright.config.{ts,js,mjs}` in cwd ← `defineConfig()`. Defaults: chrome backend, 1280×800, headless true on Windows / false elsewhere.
- `chrome-spawn.ts` — Windows workaround (see below).
- `locator.ts` — Playwright-style `Locator` / `ElementHandle`.
- `errors.ts` — `BunwrightError` base; `SelectorError`, `TimeoutError`, `ElementNotFoundError`, `BrowserError`.

### Windows Chrome workaround

`Bun.WebView`'s built-in Chrome spawn fails on win32. On Windows + chrome backend, `browser.ts` calls `spawnChrome()`: finds a free port, launches Chrome with `--remote-debugging-port`, polls `/json/version` for `webSocketDebuggerUrl`, passes that URL as the WebView backend (`backend.path`/`backend.argv` ignored). Executable resolution: `BUN_CHROME_PATH` → `config.backend.path` → common Windows install paths (local `.env` points at Edge). Killed on `browser.close()` and process exit. `BUNWRIGHT_DEBUG=1` logs the port.

## Testing / environment

- Requires a real Chrome install. `integration.test.ts` (and much of `dsl.test.ts`) hit a live browser; `chain.test.ts`, `chrome-spawn.test.ts`, `config-backend.test.ts`, etc. run without one.
- `BUN_CHROME_PATH` overrides the Chrome executable (also what CI sets).
- `packages/app/tsconfig.json` maps `bunwright` → `src/dsl/index.ts`, so `typecheck` also covers `examples/*.ts`.
- Website `sync-api` injects `docs/api-reference.md` into per-class pages between `<!-- AUTO:START -->` / `<!-- AUTO:END -->`; regenerate app docs first.
- `skills/bun-webview/SKILL.md` documents the `Bun.WebView` API; `skills/bunwright/SKILL.md` has project-specific guidance.
