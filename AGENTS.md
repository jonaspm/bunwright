# Bunwright

TypeScript-first browser automation DSL built on `Bun.WebView`.

## Dev Commands

```bash
bun install          # install deps
bun run build        # build dist/ (CLI + library, shebang applied) and emit .d.ts
bun test             # run tests (Bun's built-in runner)
bun run typecheck    # TypeScript check
bun run lint         # oxlint
bun run format       # oxfmt
bun run docs         # regenerate docs/api-reference.md from dist/*.d.ts
bun run src/bunwright.ts examples/login.ts   # run CLI directly during dev
```

## Architecture

- **CLI entrypoint**: `src/bunwright.ts` — loads `.env.local`/`.env`, imports the given script, runs its default export
- **Library entrypoint**: `src/dsl/index.ts` — exports `browser` singleton, `defineConfig`, `Locator`, `ElementHandle`, error classes
- **Build output**: `dist/bunwright.mjs` (bin) and `dist/index.mjs` (module), built by `build.ts`
- **Tests**: `tests/*.test.ts` (Bun's `bun:test`)
- **No monorepo**: single package, no runtime dependencies, publishes from `dist/`

## Usage

```bash
bunx bunwright my-flow.ts
```

```ts
// my-flow.ts
import { browser } from "bunwright";

const page = await browser.newPage();
await page.navigate("https://example.com").screenshot("./shot.png");
await browser.close();
```

## Important Quirks

- **Browser required**: `Bun.WebView` needs Chrome or WebKit installed. Set `BUN_CHROME_PATH` or use `config.backend.path` if not on PATH.
- **Windows Chrome workaround**: On `win32`, `Bun.WebView`'s built-in Chrome spawn fails. bunwright launches Chrome itself with `--remote-debugging-port` and connects via the `webSocketDebuggerUrl`. `backend.path` / `backend.argv` are ignored in this mode. Set `BUNWRIGHT_DEBUG=1` to log the spawned port. The spawned Chrome is killed on `browser.close()` and on process exit.
- **Single shared WebView**: `browser` is a singleton that lazily creates one `Bun.WebView`; all contexts and pages wrap it (no isolation between them).
- **Selectors**: prefixed strings — `role:`, `label:`, `text:`, `css:`, `xpath:`. Unprefixed strings pass through as CSS. `role:` matches implicit roles (`role:button` → `<button>`, `input[type=submit]`, …) and `[name='...']` matches aria-label/value/text. Selector resolution is async (runs JS in the page).
- **Chaining**: methods chain lazily via a proxy (`src/dsl/chain.ts`) — `page.navigate().type().click()` queues steps; awaiting flushes. Fail-fast: a failed step skips the rest and rejects with the original error. `.all()` resolves with every step's result in order. Awaiting a chain yields the final target (or the value, if the last step returns one).
- **Auto-wait + retry**: page actions wait for visible+enabled, retry up to 3 attempts with exponential backoff within `retryTimeout` (default 10s).
- **waitForURL globs**: string patterns are globs (`**`, `*`, `?`), anchored to the full URL; pass a `RegExp` for regex matching.
- **Serialized evaluate**: `Bun.WebView` rejects concurrent `evaluate()` calls, so bunwright queues them per view — `Promise.all` over page/locator reads is safe.
- **Config resolution**: defaults ← `bunwright.config.{ts,js,mjs}` in cwd ← `defineConfig()`. Defaults: `backend: "chrome"`, `width: 1280`, `height: 800`, `headless` true only on Windows.
- **Env loading**: CLI loads `.env.local` then `.env`; existing env vars are never overridden.

## CI

- Runs on Ubuntu only (`ubuntu-latest` in `.github/workflows/test.yml`).
- Publish workflow triggers on `v*` tags, removes `src/` and `tests/` before publishing.

## Skills

- `.agents/skills/bunwright/SKILL.md` — bunwright-specific guidance
- `.agents/skills/bun-webview/SKILL.md` — Bun.WebView API reference
- `skills-lock.json` — tracks external skill sources
