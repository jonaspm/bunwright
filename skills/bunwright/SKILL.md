---
name: bunwright
description: Use this skill when you need lightweight, scriptable browser automation in Bun based on `Bun.WebView`.
metadata:
  mintlify-proj: bun
  version: "2.0"
---

# Skill: bunwright

## When to Use This Skill

Use this skill when you need lightweight, scriptable browser automation in Bun based on `Bun.WebView`, especially when you want to:

- run scripted browser flows from CI, scripts, or local tooling
- write automation in TypeScript with a Playwright-style API without adopting Playwright
- reuse the `bunwright` package in another Bun project via `bun link` or `bun add`
- drive logins, form fills, screenshots, or data collection from Bun code

## What This Project Provides

This repository exposes:

- a **library** — `import { browser } from "bunwright"` — a singleton wrapping one `Bun.WebView`
- a **CLI** — `bunx bunwright <script.ts>` — loads `.env.local`/`.env`, imports the script, runs its default export

### Basic usage

```ts
// my-flow.ts
import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://example.com/login")
  .type("label:Username", process.env.APP_USER!)
  .type("label:Password", process.env.APP_PASSWORD!)
  .click("role:button[name='Login']")
  .waitForURL("**/dashboard")
  .screenshot("./generated/dashboard.png");

await browser.close();
```

```bash
bunx bunwright my-flow.ts
```

### Runtime behavior

- page actions auto-wait for elements to be visible and enabled
- failed actions retry up to 3 attempts with exponential backoff, within `retryTimeout` (default 10s)
- `browser` lazily creates one shared `Bun.WebView`; contexts and pages all wrap it (no isolation)
- `evaluate()` calls are serialized per WebView, so `Promise.all` over page/locator reads is safe
- `browser.close()` closes the WebView and kills any externally-spawned Chrome
- the CLI exits 0 on success, 1 on error (error message printed to stderr)

### Chaining

Page, Locator, and ElementHandle methods chain without intermediate awaits — chains are lazy queues flushed by `await`:

- **Fail-fast**: a failed step skips everything queued after it; awaiting rejects with the original error (`instanceof TimeoutError` preserved)
- **Await result**: resolves to the final target, or to the value if the last step returns one (`count()`, `evaluate()`, `exists()`)
- **Per-step results**: `.all()` resolves with every step's result in call order

```ts
const [, , title] = await page
  .navigate("https://example.com")
  .click("role:button")
  .evaluate(() => document.title)
  .all();
```

`waitForURL` accepts URL globs (`**/dashboard`) or a `RegExp`; globs match the full URL.

## Selectors

Prefixed strings; unprefixed strings are treated as CSS:

| Prefix   | Example                     | Matches by                |
| -------- | --------------------------- | ------------------------- |
| `css:`   | `css:button[type=submit]`   | CSS selector              |
| `role:`  | `role:button[name='Login']` | ARIA role (and name)      |
| `label:` | `label:Username`            | Associated `<label>` text |
| `text:`  | `text:Sign in`              | Visible text content      |
| `xpath:` | `xpath://button[1]`         | XPath expression          |

## Configuration

Via `bunwright.config.{ts,js,mjs}` in cwd, or `defineConfig()` in code. Resolution: defaults ← config file ← `defineConfig`.

| Field          | Type                                                       | Notes                                            |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `backend`      | `"chrome" \| "webkit" \| { type: "chrome", path?, argv? }` | Defaults to `"chrome"`                           |
| `width`        | `number`                                                   | Defaults to `1280`                               |
| `height`       | `number`                                                   | Defaults to `800`                                |
| `url`          | `string`                                                   | Initial URL                                      |
| `console`      | `boolean`                                                  | Forward page console output                      |
| `dataStore`    | `"ephemeral" \| string`                                    | Directory path for persistent state              |
| `retryTimeout` | `number`                                                   | Default `10000` ms                               |
| `headless`     | `boolean`                                                  | Defaults to `true` on Windows, `false` elsewhere |

## Key Page Methods

Chainable (return `this`): `navigate`, `back`, `forward`, `reload`, `click`, `dblClick`, `type`, `press`, `scroll`, `scrollTo`, `resize`, `screenshot`, `expect`, `check`, `waitForLoadState`.

Non-chainable: `evaluate(fn)`, `locator(sel)`, `$`/`$$` (ElementHandle snapshots), `waitForSelector`, `waitForURL`, `exists`, `waitFor`, `waitForTimeout`, `cdp(method, params)`.

## Authoring Guidance

- prefer `backend: "chrome"` for cross-platform use
- prefer `label:`/`role:` selectors over brittle CSS for form interactions
- pass `evaluate` an arrow function; it is serialized and run in the page
- avoid `waitForTimeout` when `waitForSelector`/`waitForURL`/`waitForLoadState` can express the condition
- write screenshots to a file path when you need a durable artifact
- put secrets in `.env`/`.env.local`; the CLI loads them before the script runs and never overrides existing env vars

## Windows Notes

`Bun.WebView`'s built-in Chrome spawn fails on Windows. bunwright launches Chrome itself with `--remote-debugging-port` and connects via `webSocketDebuggerUrl`. In this mode `backend.path`/`backend.argv` are ignored; executable resolution is `BUN_CHROME_PATH` → `config.backend.path` → common install locations. `BUNWRIGHT_DEBUG=1` logs the spawned port.

## Repository References

- CLI entrypoint: `src/bunwright.ts`
- library entrypoint: `src/dsl/index.ts`
- API reference: `docs/api-reference.md` (auto-generated; regenerate with `bun run docs`)
- runnable examples: `examples/*.ts`

Use those files as the source of truth when adapting bunwright in another project.
