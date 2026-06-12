# Bunwright DSL API Reference

_Auto-generated from `dist/*.d.ts` on 2026-06-12. Do not edit by hand._

Source declarations live under `src/dsl/`. Regenerate this document with `bun run docs`.

## Overview

Bunwright exposes a single `browser` instance plus class-based page automation.

**Public Exports** (from `src/dsl/index.ts`):

- Values: `browser`, `defineConfig`
- Classes: `Locator`, `ElementHandle`, `SelectorError`, `TimeoutError`, `ElementNotFoundError`, `BrowserError`, `BunwrightError`
- Types: `BrowserConfig`, `ContextOptions`, `Selector`, `LoadState`, `ResolvedSelector`

## Table of Contents

- [Classes](#classes)
- [Interfaces](#interfaces)
- [Type Aliases](#type-aliases)
- [Functions](#functions)

## Classes

### `BrowserContext`

_Declared in `dist/browser.d.ts`_

**Constructor**

- `constructor(view: WebView, browserInstance: BunwrightBrowser)`

**Properties**

- `readonly [CHAINABLE]: true`

**Methods**

- `newPage(): Promise<Page>`
- `close(): Promise<void>`

### `BrowserError` extends `BunwrightError`

_Declared in `dist/errors.d.ts`_

**Constructor**

- `constructor(message: string)`

### `BunwrightError` extends `Error`

_Declared in `dist/errors.d.ts`_

**Constructor**

- `constructor(message: string)`

### `ElementHandle`

_Declared in `dist/locator.d.ts`_

**Constructor**

- `constructor(cssSelector: string, page: Page)`

**Properties**

- `readonly [CHAINABLE]: true`

**Methods**

- `click(): Promise<void>`
- `dblClick(): Promise<void>`
- `type(text: string): Promise<void>`
- `press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<void>`
- `screenshot(opts?: { path?: string; }): Promise<void>`
- `evaluate<T>(fn: (el: Element) => T): Promise<T>`
- `innerText(): Promise<string>`
- `innerHTML(): Promise<string>`
- `getAttribute(name: string): Promise<string | null>`
- `isVisible(): Promise<boolean>`
- `isEnabled(): Promise<boolean>`

### `ElementNotFoundError` extends `BunwrightError`

_Declared in `dist/errors.d.ts`_

**Constructor**

- `constructor(message: string)`

### `Locator`

_Declared in `dist/locator.d.ts`_

**Constructor**

- `constructor(selector: Selector, page: Page)`

**Properties**

- `readonly [CHAINABLE]: true`

**Methods**

- `getPage(): Page`
- `resolveSelector(): Promise<string>`
- `click(opts?: { timeout?: number; }): Promise<void>`
- `dblClick(opts?: { timeout?: number; }): Promise<void>`
- `type(text: string, opts?: { timeout?: number; }): Promise<void>`
- `fill(text: string): Promise<void>`
- `press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<void>`
- `screenshot(opts?: { path?: string; }): Promise<void>`
- `evaluate<T>(fn: (el: Element) => T): Promise<T>`
- `innerText(): Promise<string>`
- `innerHTML(): Promise<string>`
- `getAttribute(name: string): Promise<string | null>`
- `isVisible(): Promise<boolean>`
- `isEnabled(): Promise<boolean>`
- `isChecked(): Promise<boolean>`
- `filter(sel: Selector): Locator`
- `first(): Locator`
- `last(): Locator`
- `nth(index: number): Locator`
- `count(): Promise<number>`
- `toElement(): Promise<ElementHandle>`

### `Page`

_Declared in `dist/browser.d.ts`_

**Constructor**

- `constructor(view: WebView, _context: BrowserContext)`

**Properties**

- `readonly [CHAINABLE]: true`
- `readonly webview: WebView`
- `retryTimeout: number`

**Methods**

- `close(): void`
- `navigate(url: string, opts?: { waitForLoadState?: LoadState; }): Promise<this>`
- `back(): Promise<this>`
- `forward(): Promise<this>`
- `reload(): Promise<this>`
- `click(sel: Selector, opts?: { timeout?: number; }): Promise<this>`
- `dblClick(sel: Selector, opts?: { timeout?: number; }): Promise<this>`
- `type(sel: Selector, text: string, opts?: { timeout?: number; }): Promise<this>`
- `press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<this>`
- `scroll(dx: number, dy: number): Promise<this>`
- `scrollTo(sel: Selector, opts?: { block?: "start" | "center" | "end"; timeout?: number; }): Promise<this>`
- `resize(width: number, height: number): Promise<this>`
- `screenshot(path?: string): Promise<this>`
- `expect(sel: Selector, opts?: { timeout?: number; }): Promise<this>`
- `check(sel: Selector): Promise<this>`
- `waitForLoadState(state: LoadState, opts?: { timeout?: number; }): Promise<this>`
- `evaluate<T>(fn: () => T): Promise<T>`
- `locator(sel: Selector): Locator`
- `$(sel: Selector): Promise<import("./locator.js").ElementHandle | null>`
- `$$(sel: Selector): Promise<import("./locator.js").ElementHandle[]>`
- `waitForSelector(sel: Selector, opts?: { timeout?: number; }): Promise<void>`
- `waitForURL(url: string | RegExp, opts?: { timeout?: number; }): Promise<void>`
- `exists(sel: Selector): Promise<boolean>`
- `waitFor(sel: Selector, opts?: { timeout?: number; }): Promise<boolean>`
- `waitForTimeout(ms: number): Promise<void>`
- `cdp(method: string, params?: Record<string, unknown>): Promise<unknown>`

### `SelectorError` extends `BunwrightError`

_Declared in `dist/errors.d.ts`_

**Constructor**

- `constructor(message: string)`

### `TimeoutError` extends `BunwrightError`

_Declared in `dist/errors.d.ts`_

**Constructor**

- `constructor(message: string)`

## Interfaces

### `BrowserConfig`

_Declared in `dist/config.d.ts`_

**Properties**

- `backend?: "webkit" | "chrome" | { type: "chrome"; path?: string; argv?: string[]; }`
- `width?: number`
- `height?: number`
- `url?: string`
- `console?: boolean`
- `dataStore?: "ephemeral" | string`
- `retryTimeout?: number`
- `/**`
- `* `--headless=new`. When false, it runs in headed mode. Defaults to true`
- `* on Windows, false elsewhere.`
- `*/`
- `headless?: boolean`

**Methods**

- `* When true, the externally-spawned Chrome (Windows workaround) runs in`

### `ChainTarget`

_Declared in `dist/chain.d.ts`_

**Properties**

- `readonly [CHAINABLE]: true`

### `ContextOptions`

_Declared in `dist/browser.d.ts`_

**Properties**

- `viewport?: { width: number; height: number; }`
- `extraHeaders?: Record<string, string>`
- `cookies?: Array<{ name: string; value: string; domain?: string; path?: string; }>`

### `ResolvedSelector`

_Declared in `dist/selectors.d.ts`_

**Properties**

- `css: string`
- `isCoordinate: boolean`
- `x?: number`
- `y?: number`

## Type Aliases

### `LoadState`

_Declared in `dist/selectors.d.ts`_

```typescript
"load" | "domcontentloaded" | "networkidle";
```

### `Selector`

_Declared in `dist/selectors.d.ts`_

```typescript
`role:${string}` | `label:${string}` | `text:${string}` | `css:${string}` | `xpath:${string}`;
```

## Functions

### `chainable`

_Declared in `dist/chain.d.ts`_

```typescript
chainable(target: T): Chain<T>
```

### `defineConfig`

_Declared in `dist/config.d.ts`_

```typescript
defineConfig(config: BrowserConfig): BrowserConfig
```
