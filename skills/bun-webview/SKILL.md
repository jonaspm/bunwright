---
name: bun-webview
description: Use when you need to build, automate, or document desktop-style browser windows and browser automation flows with Bun's `Bun.WebView` API. Reach for this skill when creating a new `Bun.WebView`, configuring constructor parameters, calling instance methods, using page state properties, or wiring CDP and event-based integrations.
metadata:
  mintlify-proj: bun
  version: "1.0"
---

# Bun WebView Skill

## When to Use This Skill

Use this skill when you are:

- Creating a desktop window or browser automation target with Bun's `Bun.WebView` API
- Loading HTML, navigating to URLs, or evaluating JavaScript in a page
- Documenting or implementing `Bun.WebView` constructor options
- Looking up instance methods such as `navigate()`, `evaluate()`, `screenshot()`, `click()`, `type()`, `press()`, `scroll()`, `resize()`, `goBack()`, `goForward()`, `reload()`, or `cdp()`
- Using page state properties like `view.url`, `view.title`, and `view.loading`
- Handling `EventTarget` events, especially Chrome backend CDP events dispatched as `MessageEvent`
- Configuring backend selection, console capture, and persistent profiles

## Product Summary

`Bun.WebView` is available starting in Bun `v1.3.12`.

Bun's `Bun.WebView` API provides a native webview/browser automation surface you can create directly from Bun. It supports multiple backends, including WebKit and Chrome, and is intended for lightweight desktop apps, internal tools, testing flows, and browser-driven automation without a full Electron-style stack.

At a high level, you:

1. Create a new `Bun.WebView` instance
2. Pass constructor options to configure the backend, initial page, logging, and persistence
3. Use instance methods to navigate, evaluate code, click, type, scroll, resize, capture screenshots, or send raw CDP commands
4. Read page state from properties like `view.url`, `view.title`, and `view.loading`
5. Listen for events because `Bun.WebView` extends `EventTarget`

One browser subprocess is shared per Bun process. Additional `new Bun.WebView()` calls open tabs in the same instance.

## Quick Start

### Create a new `Bun.WebView`

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://bun.sh",
  console: globalThis.console,
});

view.navigate("https://bun.sh/docs");
await view.evaluate("document.title");
```

### Load inline HTML with a data URL

```ts
const html = `<!doctype html>
<html>
  <body>
    <h1>Hello from Bun WebView</h1>
  </body>
</html>`;

const webview = new Bun.WebView({
  width: 800,
  height: 600,
  url: `data:text/html,${encodeURIComponent(html)}`,
});

await webview.evaluate("document.querySelector('h1')?.textContent");
```

### Evaluate JavaScript in the page

```ts
const view = new Bun.WebView({
  backend: "webkit",
  url: "https://example.com",
});

await view.evaluate(`
  (() => {
    document.body.style.background = "black";
    document.body.style.color = "white";
    return document.title;
  })()
`);
```

## Core Concepts

### 1. Creating a `Bun.WebView` instance

The main entry point is constructing a new `Bun.WebView`:

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com",
  console: globalThis.console,
});
```

You generally provide one object containing the initial configuration.

Common patterns:

- Use `url` when loading a remote or local page
- Choose `backend: "webkit"` for the WebKit backend
- Choose `backend: "chrome"` for the Chrome backend
- Use `backend: { type: "chrome", path, argv }` when you need a custom Chrome executable or launch arguments
- Use `console` to capture page logs
- Use `dataStore` for persistent profiles and browser state

### 2. Constructor parameters

The constructor accepts an options object. The key documented options for `v1.3.12` are:

| Parameter   | Type                                                                         | Purpose                                                                |
| ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `backend`   | `"webkit" \| "chrome" \| { type: "chrome", path?: string, argv?: string[] }` | Select the backend or provide a custom Chrome executable and arguments |
| `url`       | `string`                                                                     | Initial URL to load                                                    |
| `console`   | `typeof console` or `(type, ...args) => void`                                | Capture page logs                                                      |
| `dataStore` | profile/persistence object or path                                           | Persist browser profile data across runs                               |

### Parameter guidance

- Use `backend: "webkit"` for the WebKit backend
- Use `backend: "chrome"` for the built-in Chrome backend
- Use `backend: { type: "chrome", path, argv }` when you need a specific Chrome/Chromium binary or launch flags
- Prefer `url` for most real usage
- Use `console: globalThis.console` to forward page logs directly to Bun's console
- Use `console: (type, ...args) => { ... }` when you need custom console handling
- Use `dataStore` when you need cookies, sessions, or persistent browser state across runs

### 3. Instance methods

After creating a `Bun.WebView`, you control it through instance methods. Most of the high-level automation methods work across both backends, while `cdp()` is Chrome-only.

#### Navigation and evaluation

- `navigate(url)` — navigate to a URL
- `evaluate(expr)` — evaluate a JavaScript expression in the page; wrap statement sequences in an IIFE
- `goBack()` — navigate backward in history
- `goForward()` — navigate forward in history
- `reload()` — reload the current page

#### Screenshots and automation

- `screenshot({ format, quality, encoding })` — capture a PNG, JPEG, or WebP screenshot
- `click(x, y)` — click at viewport coordinates
- `click(selector)` — click an element matched by a CSS selector
- `type(text)` — type text into the focused element
- `press(key, { modifiers })` — press a key with optional modifiers
- `scroll(dx, dy)` — scroll by delta
- `scrollTo(selector)` — scroll to an element matched by a selector

#### Viewport and protocol control

- `resize(w, h)` — resize the viewport
- `cdp(method, params)` — send a raw Chrome DevTools Protocol call

### Page state properties

- `view.url` — current page URL
- `view.title` — current page title
- `view.loading` — whether the page is currently loading

## Common Usage Patterns

### Navigate to a page

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://bun.sh",
});

await view.navigate("https://bun.sh/docs");
```

### Evaluate JavaScript and read page state

```ts
const view = new Bun.WebView({
  backend: "webkit",
  url: "https://example.com",
});

await view.evaluate("document.title");
console.log(view.url);
console.log(view.title);
console.log(view.loading);
```

`evaluate()` only accepts expressions. For multi-statement logic, wrap the code in an IIFE:

```ts
await view.evaluate(`
  (() => {
    const title = document.title;
    return title.toUpperCase();
  })()
`);
```

### Capture a screenshot

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com",
});

const image = await view.screenshot({
  format: "png",
  encoding: "base64",
});
```

### Click and type

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com/login",
});

await view.click("input[name=email]");
await view.type("user@example.com");
await view.press("Tab");
await view.type("secret");
```

### Scroll and resize

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com",
});

await view.scroll(0, 500);
await view.scrollTo("#footer");
await view.resize(1440, 900);
```

### Use raw CDP on the Chrome backend

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com",
});

await view.cdp("Runtime.evaluate", {
  expression: "document.title",
});
```

## Events and backend behavior

`Bun.WebView` extends `EventTarget`.

On the Chrome backend:

- CDP events are dispatched as `MessageEvent`
- event payload parameters are available on `event.data`

Typical pattern:

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "https://example.com",
});

view.addEventListener("Page.loadEventFired", (event) => {
  console.log(event.data);
});
```

### Guidance for events

- Use event listeners when you need low-level Chrome backend observability
- Prefer higher-level methods like `navigate()`, `evaluate()`, and `click()` for normal automation
- Use `cdp()` plus event listeners when you need protocol-level control

## Automation-oriented interaction model

The primary interaction model in `v1.3.12` is automation-oriented rather than a custom page-to-native binding API.

Typical flow:

1. Create a `Bun.WebView`
2. Navigate to a page
3. Use methods like `click()`, `type()`, `press()`, `scroll()`, and `evaluate()`
4. Read state from `view.url`, `view.title`, and `view.loading`
5. Use `cdp()` and events for advanced Chrome backend control

Use this pattern for:

- Login flows
- Form filling
- Screenshot capture
- Browser-driven testing
- Internal automation tools
- Protocol-level inspection on Chrome

## Decision Guide

| Goal                                   | Recommended approach                          |
| -------------------------------------- | --------------------------------------------- |
| Load a website or local dev server     | Use `url`                                     |
| Choose the rendering/automation engine | Set `backend`                                 |
| Use a custom Chrome binary             | Use `backend: { type: "chrome", path, argv }` |
| Capture page logs                      | Use `console`                                 |
| Persist cookies and sessions           | Use `dataStore`                               |
| Run page-side code from Bun            | Use `evaluate()`                              |
| Click elements or coordinates          | Use `click()`                                 |
| Fill forms                             | Use `type()` and `press()`                    |
| Capture screenshots                    | Use `screenshot()`                            |
| Use low-level Chrome protocol features | Use `cdp()` plus events                       |

## Workflow

### 1. Verify Bun version

Confirm you are using Bun `v1.3.12` or newer.

### 2. Create the view

Start with the smallest working constructor:

```ts
const view = new Bun.WebView({
  backend: "chrome",
  url: "http://localhost:3000",
});
```

### 3. Choose the backend

Pick `"webkit"` or `"chrome"` based on your needs, or provide a custom Chrome executable object.

### 4. Add automation steps

Use `navigate()`, `evaluate()`, `click()`, `type()`, `press()`, `scroll()`, and `resize()`.

### 5. Add persistence and logging

Configure `dataStore` and `console` if needed.

### 6. Add advanced Chrome integration

Use `cdp()` and event listeners only when higher-level methods are not enough.

## Best Practices

- Start with a minimal constructor and add options incrementally
- Use Bun `v1.3.12` or newer
- Prefer `url` plus automation methods for most workflows
- Choose the backend explicitly when behavior matters
- Use `console` during development to capture page logs
- Use `console: globalThis.console` or a callback, not `true`
- Use `dataStore` when you need persistent browser state
- Prefer high-level methods like `click()`, `type()`, and `scrollTo()` before dropping to `cdp()`
- Treat `evaluate()` as a sharp tool; keep expressions focused and deterministic
- Remember that `evaluate()` accepts expressions, so wrap statement blocks in an IIFE when needed
- Remember that one browser subprocess is shared per Bun process, and additional views open tabs in the same instance

## Common Gotchas

- **Version requirement**: `Bun.WebView` starts in `v1.3.12`
- **Backend differences**: Chrome-specific protocol behavior is available through `cdp()` and event dispatch, even though the documented high-level methods work across both backends
- **Shared browser process**: additional `new Bun.WebView()` calls open tabs in the same browser instance for the current Bun process
- **Custom Chrome launch config**: if you use `backend: { type: "chrome", path, argv }`, make sure the executable path and arguments are valid on the target machine
- **Overusing `evaluate()`**: use it for focused DOM or JS tasks, not as your entire automation architecture
- **Expression-only evaluation**: `evaluate()` wraps your code as `await (${script})`, so statement blocks must be wrapped in an IIFE
- **Selector fragility**: `click(selector)` and `scrollTo(selector)` depend on stable DOM structure
- **CDP event handling**: on Chrome, protocol events arrive as `MessageEvent` with payload in `event.data`

## Verification Checklist

Before you ship or hand off WebView work:

- [ ] Confirm Bun is `v1.3.12` or newer
- [ ] Verify the app can create a new `Bun.WebView` instance
- [ ] Confirm constructor parameters like `backend`, `console`, and `dataStore` are documented and used intentionally
- [ ] Test key instance methods like `navigate()`, `evaluate()`, `screenshot()`, `click()`, `type()`, `press()`, `scroll()`, `resize()`, `back()`, `forward()`, and `reload()`
- [ ] Verify page state properties like `view.url`, `view.title`, and `view.loading`
- [ ] Test Chrome backend `cdp()` calls if you rely on them
- [ ] Test event handling if you consume Chrome CDP events
- [ ] Confirm shared-process/tab behavior is acceptable for your app design
- [ ] Test on the actual target OS and backend combination

## Reference Template for Agent Work

When documenting or implementing Bun WebView, structure your output around:

1. **How to create a new `Bun.WebView`**
2. **Constructor parameters**
3. **Instance methods**
4. **Page state properties**
5. **Events and Chrome backend CDP behavior**
6. **Examples**
7. **Version/backend caveats**

## Resources

- **Bun docs index**: https://bun.com/docs
- **Bun reference**: https://bun.com/reference
- **Bun release notes/blog**: https://bun.com/blog
- **Bun repository**: https://github.com/oven-sh/bun

---

> Note: `Bun.WebView` starts in Bun `v1.3.12`. The documented high-level methods listed in this skill work across both WebKit and Chrome backends, while Chrome also exposes raw CDP access and dispatches protocol events through `EventTarget` as `MessageEvent` objects with payload in `event.data`.
