<h1 align="center">
  <strong>Bunwright</strong>
</h1>

<p align="center">
  <strong>The lightweight browser automation library for Bun</strong>
</p>

<p align="center">
  TypeScript-first browser automation built on <code>Bun.WebView</code> —
  a smaller, Bun-native alternative for flows where Playwright would be heavier than necessary.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/bunwright"><img src="https://img.shields.io/npm/v/bunwright" alt="npm version"></a>
  <a href="https://github.com/jonaspm/bunwright/actions/workflows/test.yml"><img src="https://github.com/jonaspm/bunwright/actions/workflows/test.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE.md"><img src="https://img.shields.io/badge/license-LGPL--2.1-blue" alt="License: LGPL-2.1"></a>
</p>

---

```ts
import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://example.com/login")
  .type("label:Username", "user@example.com")
  .type("label:Password", process.env.APP_PASSWORD!)
  .click("role:button[name='Login']")
  .waitForURL("**/dashboard")
  .screenshot("./dashboard.png");

await browser.close();
```

## Why Bunwright

Fast, zero-dependency, TypeScript-first, and small enough for AI agents to drive reliably, Bunwright is the lighter alternative to a full end-to-end testing stack like Playwright. Use it for logins, screenshots, data collection, scraping, and other browser tasks that don't need a full test framework.

Bunwright targets exactly that space:

- **Bun-native** — built directly on `Bun.WebView`, zero runtime dependencies, no browser downloads. Uses the Chrome or WebKit already on the machine.
- **Playwright-style API** — pages, locators, auto-waiting, semantic selectors. Familiar surface, smaller scope.
- **Chainable** — actions queue lazily and run on `await`, with fail-fast semantics and per-step results.
- **Scriptable** — write a TypeScript file, run it with `bunx bunwright script.ts` or plain `bun run`. `.env` loading built in.

There are no fixtures, parallel workers, or trace viewers yet — for full end-to-end test suites, use Playwright.

## Use Cases

- Automate repetitive internal web workflows: logins, form filling, admin panel tasks
- Capture screenshots of pages or post-login states from scripted sessions
- Run lightweight browser-driven data collection or verification flows
- Prototype browser automations in Bun without adopting a larger testing framework
- Drive browser automation from other Bun tools, scripts, or local CLIs

## Installation

```bash
bun add bunwright        # as a project dependency
npm install -g bunwright # or globally, for the CLI
```

Requires [Bun](https://bun.com) and an existing Chrome (or WebKit) installation — bunwright does not download browsers.

## Quick Start

Write a script:

```ts
// shot.ts
import { browser } from "bunwright";

const page = await browser.newPage();
await page.navigate("https://example.com").screenshot("./example.png");
await browser.close();
```

Run it:

```bash
bunx bunwright shot.ts
```

The CLI loads `.env.local`/`.env` first and runs the script's default export if one exists. The CLI is optional — any `bun run` script can import `bunwright` directly.

## Selectors

Selectors are prefixed strings; unprefixed strings are treated as CSS.

| Prefix   | Example                     | Matches by                |
| -------- | --------------------------- | ------------------------- |
| `css:`   | `css:button[type=submit]`   | CSS selector              |
| `role:`  | `role:button[name='Login']` | ARIA role + name          |
| `label:` | `label:Username`            | Associated `<label>` text |
| `text:`  | `text:Sign in`              | Visible text content      |
| `xpath:` | `xpath://button[1]`         | XPath expression          |

`role:` matches explicit `[role=...]` attributes **and** implicit roles — `role:button` finds `<button>`, `input[type=submit]`, and `[role="button"]` elements. The optional `[name='...']` part matches against `aria-label`, input value, or trimmed text content.

Every page action auto-waits for the element to be visible and enabled, then retries up to 3 times with exponential backoff within `retryTimeout` (10s by default).

## Chaining

Methods on `Page`, `Locator`, and `ElementHandle` chain without intermediate awaits. A chain is a lazy queue: each call enqueues a step, awaiting executes them sequentially.

```ts
await page
  .navigate("https://example.com/login")
  .type("label:Username", "user")
  .click("role:button[name='Login']")
  .waitForURL("**/dashboard");
```

**Fail-fast.** If a step throws, every step queued after it is skipped, and the `await` rejects with the original error:

```ts
import { browser, TimeoutError } from "bunwright";

try {
  await page
    .navigate("https://example.com")
    .click("role:button[name='Missing']") // throws TimeoutError
    .waitForURL("**/success"); // never runs
} catch (error) {
  if (error instanceof TimeoutError) {
    // handle, fall back, continue
  }
}
```

**Await result.** Awaiting a chain resolves to the final target — the page, or a locator if the chain switched to one. If the last step returns a value (`count()`, `evaluate()`, `exists()`), awaiting resolves to that value:

```ts
const count = await page.locator("css:input").count(); // number
const title = await page.evaluate(() => document.title); // string
```

**Per-step results.** Call `.all()` instead of awaiting to get every step's result as an array, in call order:

```ts
const [, , title] = await page
  .navigate("https://example.com")
  .click("role:button")
  .evaluate(() => document.title)
  .all();
```

## API Overview

Full reference: [`docs/api-reference.md`](./docs/api-reference.md) (generated from the type declarations).

### `browser`

Singleton entry point.

| Method                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `newPage(options?)`    | Open a page (creates the WebView lazily)            |
| `newContext(options?)` | Create a context (viewport, extra headers, cookies) |
| `close()`              | Close all contexts, the WebView, and spawned Chrome |

### `Page`

| Group       | Methods                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| Navigation  | `navigate`, `back`, `forward`, `reload`, `waitForLoadState`, `waitForURL`   |
| Interaction | `click`, `dblClick`, `type`, `press`, `scroll`, `scrollTo`, `resize`        |
| Inspection  | `evaluate`, `locator`, `$`, `$$`, `exists`, `expect`, `check`, `screenshot` |
| Waiting     | `waitForSelector`, `waitFor`, `waitForTimeout`                              |
| Low-level   | `cdp(method, params)` — raw Chrome DevTools Protocol calls                  |

`waitForURL` accepts a URL glob (`**` spans `/`, `*` stays within a segment, `?` is one character; anchored to the full URL) or a `RegExp`.

### `Locator`

Created with `page.locator(selector)`. Lazy — resolves on each action.

| Group     | Methods                                                       |
| --------- | ------------------------------------------------------------- |
| Actions   | `click`, `dblClick`, `type`, `fill`, `press`, `screenshot`    |
| Reading   | `innerText`, `innerHTML`, `getAttribute`, `evaluate`, `count` |
| State     | `isVisible`, `isEnabled`, `isChecked`                         |
| Narrowing | `filter`, `first`, `last`, `nth`, `toElement`                 |

### Errors

All errors extend `BunwrightError`: `TimeoutError`, `ElementNotFoundError`, `SelectorError`, `BrowserError`. Import them to branch on failure type.

## Configuration

Via `bunwright.config.ts` in the project root, or programmatically with `defineConfig`:

```ts
// bunwright.config.ts
import { defineConfig } from "bunwright";

export default defineConfig({
  backend: "chrome", // "webkit" | "chrome" | { type: "chrome", path, argv }
  width: 1440, // default 1280
  height: 900, // default 800
  url: "", // initial URL when the WebView opens
  console: true, // forward page console logs
  dataStore: "ephemeral", // or a directory path for persistent state
  retryTimeout: 10000, // auto-wait/retry budget per action, ms
  headless: true, // default: true on Windows, false elsewhere
});
```

Resolution order: built-in defaults ← config file ← `defineConfig()` call.

## Environment Variables

The CLI loads `.env.local` and `.env` from the working directory before running the script. Existing environment variables are never overridden.

| Variable          | Effect                                                      |
| ----------------- | ----------------------------------------------------------- |
| `BUN_CHROME_PATH` | Path to the Chrome executable (checked first on Windows)    |
| `BUNWRIGHT_DEBUG` | `1` logs the spawned Chrome debug port (Windows workaround) |

## Windows

`Bun.WebView` has a known issue spawning its own Chrome subprocess on Windows. Bunwright works around it automatically: it launches Chrome with `--remote-debugging-port=<port>`, polls `http://127.0.0.1:<port>/json/version` for the `webSocketDebuggerUrl`, and connects `Bun.WebView` to that endpoint.

- Chrome executable resolution: `BUN_CHROME_PATH` → `config.backend.path` → common install locations.
- In workaround mode, `backend.path` and `backend.argv` are ignored.
- The spawned Chrome is killed on `browser.close()` and on process exit.

## Examples

Runnable demos live in [`examples/`](./examples):

| File                | Shows                                                         |
| ------------------- | ------------------------------------------------------------- |
| `screenshot.ts`     | Minimal navigate + screenshot                                 |
| `login.ts`          | `label:`/`role:` selectors, glob `waitForURL`, parallel reads |
| `form-fill.ts`      | CSS selectors, `Locator.count()`                              |
| `error-handling.ts` | Fail-fast chains, `TimeoutError` handling, soft `exists()`    |
| `evaluate.ts`       | `evaluate()` and raw CDP calls                                |
| `multi-context.ts`  | Two contexts driven in parallel                               |

```bash
bun run src/bunwright.ts examples/login.ts
```

## Development

```bash
bun install          # dependencies
bun test             # unit + integration tests (bun:test)
bun run typecheck    # tsc, also covers examples/
bun run lint         # oxlint
bun run format       # oxfmt
bun run build        # bundle dist/ + emit type declarations
bun run docs         # regenerate docs/api-reference.md
```

To use a local checkout from another Bun project:

```bash
bun link             # in this repository
bun link bunwright   # in the consuming project
```

## License

[LGPL-2.1](./LICENSE.md) © Jonas Perusquia Morales
