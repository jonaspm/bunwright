<h1 align="center">
  <strong>Bunwright</strong>
</h1>

<p align="center">
  <strong>The lightweight browser automation library for Bun</strong>
</p>

<p align="center">
  TypeScript-first browser automation built on <code>Bun.WebView</code>.
  <br />
  A smaller, Bun-native alternative for automation flows where Playwright would be heavier than necessary.
</p>

---

`bunwright` is a lightweight browser automation library for Bun focused on simple, scriptable workflows.
You write automation scripts in TypeScript using a Playwright-style API and run them through `Bun.WebView`, making it useful for local automation, repeatable UI flows, and small browser-driven utilities.

If you want a Playwright alternative for Bun that is smaller in scope, faster to wire into Bun projects, and centered on lightweight automation instead of a full end-to-end testing stack, `bunwright` is built for that space.

## Use Cases

- Automate repetitive internal web workflows such as logins, form filling, and admin panel tasks
- Capture screenshots of pages or post-login states from scripted browser sessions
- Run lightweight browser-driven data collection or verification flows
- Prototype browser automations in Bun without adopting a larger testing framework
- Drive browser automation from other Bun tools, scripts, or local CLIs

## Install

### npm

Install globally with npm:

```bash
npm install -g bunwright
```

Or add it to a Bun project:

```bash
bun add bunwright
```

### Development

Install dependencies in this repository:

```bash
bun install
```

Run a script directly during development:

```bash
bun run src/bunwright.ts examples/login.ts
```

## Quick Start

Write an automation script with a default export:

```ts
// my-flow.ts
import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://example.com")
  .screenshot("./example.png");

await browser.close();
```

Run it with the CLI:

```bash
bunx bunwright my-flow.ts
```

Or import `bunwright` directly in any Bun script and run it with `bun run` — the CLI is optional.

## Example

A login flow using label and role selectors:

```ts
import { browser } from "bunwright";

const page = await browser.newPage();

await page
  .navigate("https://the-internet.herokuapp.com/login")
  .type("label:Username", "tomsmith")
  .type("label:Password", "SuperSecretPassword!")
  .click("role:button[name=' Login']")
  .waitForURL("**/secure");

const title = await page.evaluate(() => document.title);
console.log("Logged in:", title);

await page.screenshot("./login-success.png");
await browser.close();
```

More runnable examples live in `examples/`.

## Selectors

Selectors are prefixed strings; unprefixed strings are treated as CSS:

| Prefix    | Example                        | Matches by                  |
| --------- | ------------------------------ | --------------------------- |
| `css:`    | `css:button[type=submit]`      | CSS selector                |
| `role:`   | `role:button[name='Login']`    | ARIA role (and name)        |
| `label:`  | `label:Username`               | Associated `<label>` text   |
| `text:`   | `text:Sign in`                 | Visible text content        |
| `xpath:`  | `xpath://button[1]`            | XPath expression            |

Page actions auto-wait for elements to be visible and enabled, and retry failed actions up to 3 times with exponential backoff (10s timeout by default).

`role:` selectors match explicit `[role=...]` attributes as well as implicit roles (e.g. `role:button` matches `<button>` and `input[type=submit]`); the optional `[name='...']` part matches the element's `aria-label`, value, or trimmed text content.

## Chaining

Page, Locator, and ElementHandle methods chain without intermediate awaits. A chain is a lazy queue: each call enqueues a step, and awaiting the chain executes the steps sequentially.

```ts
await page
  .navigate("https://example.com/login")
  .type("label:Username", "user")
  .click("role:button[name='Login']")
  .waitForURL("**/dashboard");
```

Semantics:

- **Fail-fast** — if a step throws, the steps queued after it never execute, and awaiting the chain rejects with the original error (`instanceof TimeoutError` etc. preserved).
- **Await result** — awaiting a chain resolves to the final target (the page, or e.g. a locator after `.locator(...)` mid-chain). If the last step returns a value (`count()`, `evaluate()`, `exists()`), awaiting resolves to that value instead.
- **Per-step results** — call `.all()` instead of awaiting to get every step's result as an array, in call order:

```ts
const [, , title] = await page
  .navigate("https://example.com")
  .click("role:button")
  .evaluate(() => document.title)
  .all();
```

`waitForURL` accepts a glob pattern (`**` matches across `/`, `*` within a segment, `?` a single character) or a `RegExp`. Glob patterns match the full URL.

## Configuration

Configure via `bunwright.config.ts` in your project root, or programmatically with `defineConfig`:

```ts
// bunwright.config.ts
import { defineConfig } from "bunwright";

export default defineConfig({
  backend: "chrome",     // "webkit" | "chrome" | { type: "chrome", path, argv }
  width: 1440,
  height: 900,
  console: true,          // forward page console logs
  dataStore: "ephemeral", // or a directory path for persistent state
  retryTimeout: 10000,
  headless: true,         // defaults to true on Windows, false elsewhere
});
```

Defaults: `chrome` backend, 1280×800 viewport.

The full API surface (Page, Locator, ElementHandle, errors) is documented in `docs/api-reference.md`.

## Environment Variables

The CLI loads `.env.local` and `.env` from the working directory before running your script. Existing environment variables are never overridden.

```ts
import { browser } from "bunwright";

const page = await browser.newPage();
await page
  .navigate("https://example.com/login")
  .type("label:Username", process.env.APP_USER!)
  .type("label:Password", process.env.APP_PASSWORD!);
```

## Link The CLI Into Another Bun Project

From this repository:

```bash
bun link
```

From the other project:

```bash
bun link bunwright
```

Then run the linked executable:

```bash
bunwright my-flow.ts
```

This project was created using `bun init` in bun v1.3.12. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Windows

`Bun.WebView` has a known issue spawning its own Chrome subprocess on Windows. To work around it, bunwright automatically launches Chrome itself with `--remote-debugging-port=<port>`, polls `http://127.0.0.1:<port>/json/version` for the browser's `webSocketDebuggerUrl`, and connects `Bun.WebView` to that endpoint.

Resolution order for the Chrome executable: `BUN_CHROME_PATH` env var → `config.backend.path` → common Windows install locations. The spawned Chrome is killed on `browser.close()` and on process exit. Set `BUNWRIGHT_DEBUG=1` to log the spawned port.

In workaround mode, `backend.path` and `backend.argv` are ignored.
