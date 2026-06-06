import { WebView } from "bun";
import type { BrowserConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import type { Selector } from "./selectors.js";
import { SelectorResolver } from "./selectors.js";
import type { LoadState } from "./selectors.js";
import { TimeoutError, ElementNotFoundError } from "./errors.js";
import type { Locator } from "./locator.js";

export interface ContextOptions {
  viewport?: { width: number; height: number };
  extraHeaders?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
}

class BunwrightBrowser {
  #config: BrowserConfig = {};
  #resolvedConfig: Awaited<ReturnType<typeof resolveConfig>> | null = null;
  #view: WebView | null = null;
  #contexts: Set<BrowserContext> = new Set();

  async #ensureView(): Promise<WebView> {
    if (!this.#view) {
      this.#resolvedConfig = await resolveConfig();
      const opts: Bun.WebView.ConstructorOptions = {
        backend: this.#resolvedConfig.backend,
        width: this.#resolvedConfig.width,
        height: this.#resolvedConfig.height,
        url: this.#resolvedConfig.url,
        console: this.#resolvedConfig.console ? globalThis.console : undefined,
        dataStore: this.#resolvedConfig.dataStore === "ephemeral"
          ? "ephemeral"
          : this.#resolvedConfig.dataStore
            ? { directory: this.#resolvedConfig.dataStore }
            : undefined,
      };
      this.#view = new WebView(opts);
    }
    return this.#view;
  }

  config(opts?: BrowserConfig): void {
    if (opts) {
      this.#config = { ...this.#config, ...opts };
    }
  }

  async newContext(opts?: ContextOptions): Promise<BrowserContext> {
    const view = await this.#ensureView();

    if (opts?.viewport) {
      await view.resize(opts.viewport.width, opts.viewport.height);
    }

    if (opts?.extraHeaders) {
      await view.cdp("Network.setExtraHeaders", { headers: opts.extraHeaders });
    }

    if (opts?.cookies && opts.cookies.length > 0) {
      const firstCookie = opts.cookies[0]!;
      const domain = firstCookie.domain ?? new URL(view.url).hostname;
      await view.cdp("Network.setCookies", {
        cookies: opts.cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? domain,
          path: c.path ?? "/",
        })),
      });
    }

    const context = new BrowserContext(view, this);
    this.#contexts.add(context);
    return context;
  }

  async close(): Promise<void> {
    for (const ctx of this.#contexts) {
      await ctx.close();
    }
    this.#contexts.clear();
    if (this.#view) {
      this.#view.close();
      this.#view = null;
    }
  }

  removeContext(context: BrowserContext): void {
    this.#contexts.delete(context);
  }
}

export const browser = new BunwrightBrowser();

export class BrowserContext {
  #view: WebView;
  #browser: BunwrightBrowser;
  #pages: Set<Page> = new Set();

  constructor(view: WebView, browser: BunwrightBrowser) {
    this.#view = view;
    this.#browser = browser;
  }

  async newPage(): Promise<Page> {
    const page = new Page(this.#view, this);
    this.#pages.add(page);
    return page;
  }

  async close(): Promise<void> {
    for (const page of this.#pages) {
      page.close();
    }
    this.#pages.clear();
    this.#browser.removeContext(this);
  }
}

export class Page {
  readonly webview: WebView;
  retryTimeout: number;
  #closed = false;
  #resolver: SelectorResolver;

  constructor(view: WebView, context: BrowserContext) {
    this.webview = view;
    this.#resolver = new SelectorResolver(view);
    this.retryTimeout = 10000;
  }

  #setClosed(): void {
    this.#closed = true;
  }

  close(): void {
    this.#setClosed();
  }

  async #ensureNotClosed(): Promise<void> {
    if (this.#closed) {
      throw new Error("Page is closed");
    }
  }

  async #retry<T>(fn: () => Promise<T>, timeout?: number): Promise<T> {
    const maxTime = timeout ?? this.retryTimeout;
    const start = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (Date.now() - start >= maxTime) {
          break;
        }
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        await Bun.sleep(delay);
      }
    }

    throw lastError;
  }

  async #waitForElementVisible(sel: Selector, timeout?: number): Promise<void> {
    const resolved = this.#resolver.resolve(sel);
    const maxTime = timeout ?? this.retryTimeout;
    const start = Date.now();

    while (Date.now() - start < maxTime) {
      const visible = await this.webview.evaluate(`
        (() => {
          const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
        })()
      `) as boolean;

      if (visible) {
        return;
      }

      await Bun.sleep(50);
    }

    throw new TimeoutError(`Element ${sel} not visible within ${maxTime}ms`);
  }

  async #waitForElementEnabled(sel: Selector, timeout?: number): Promise<void> {
    const resolved = this.#resolver.resolve(sel);
    const maxTime = timeout ?? this.retryTimeout;
    const start = Date.now();

    while (Date.now() - start < maxTime) {
      const enabled = await this.webview.evaluate(`
        (() => {
          const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
          if (!el) return false;
          return !el.hasAttribute('disabled') && !el.hasAttribute('readonly');
        })()
      `) as boolean;

      if (enabled) {
        return;
      }

      await Bun.sleep(50);
    }

    throw new TimeoutError(`Element ${sel} not enabled within ${maxTime}ms`);
  }

  async #autoWait(sel: Selector, timeout?: number): Promise<void> {
    await this.#waitForElementVisible(sel, timeout);
    await this.#waitForElementEnabled(sel, timeout);
  }

  async navigate(url: string, opts?: { waitForLoadState?: LoadState }): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.navigate(url);
    if (opts?.waitForLoadState) {
      await this.waitForLoadState(opts.waitForLoadState);
    }
    return this;
  }

  async back(): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.back();
    return this;
  }

  async forward(): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.forward();
    return this;
  }

  async reload(): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.reload();
    return this;
  }

  async click(sel: Selector, opts?: { timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    await this.#retry(async () => {
      await this.#autoWait(sel, opts?.timeout);
      const resolved = this.#resolver.resolve(sel);
      await this.webview.click(resolved.css);
    }, opts?.timeout);
    return this;
  }

  async dblClick(sel: Selector, opts?: { timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    await this.#retry(async () => {
      await this.#autoWait(sel, opts?.timeout);
      const resolved = this.#resolver.resolve(sel);
      await this.webview.evaluate(`
        (() => {
          const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
          if (!el) throw new Error('Element not found');
          const rect = el.getBoundingClientRect();
          const events = new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
          el.dispatchEvent(events);
        })()
      `);
    }, opts?.timeout);
    return this;
  }

  async type(sel: Selector, text: string, opts?: { timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    await this.#retry(async () => {
      await this.click(sel, opts);
      await this.webview.type(text);
    }, opts?.timeout);
    return this;
  }

  async press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.press(key, modifiers ? { modifiers } : undefined);
    return this;
  }

  async scroll(dx: number, dy: number): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.scroll(dx, dy);
    return this;
  }

  async scrollTo(sel: Selector, opts?: { block?: "start" | "center" | "end"; timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    await this.#autoWait(sel, opts?.timeout);
    await this.webview.scrollTo(sel, opts?.block ? { block: opts.block } : undefined);
    return this;
  }

  async resize(width: number, height: number): Promise<this> {
    await this.#ensureNotClosed();
    await this.webview.resize(width, height);
    return this;
  }

  async screenshot(path?: string): Promise<this> {
    await this.#ensureNotClosed();
    const image = await this.webview.screenshot({ encoding: "blob" });
    if (path) {
      await Bun.write(path, image);
    }
    return this;
  }

  async expect(sel: Selector, opts?: { timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    await this.#retry(async () => {
      const resolved = this.#resolver.resolve(sel);
      await this.webview.evaluate(`
        (() => {
          const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
          if (!el) throw new Error('Element not found');
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) throw new Error('Element not visible');
          if (window.getComputedStyle(el).visibility === 'hidden' || window.getComputedStyle(el).display === 'none') throw new Error('Element not visible');
        })()
      `);
    }, opts?.timeout);
    return this;
  }

  async check(sel: Selector): Promise<this> {
    await this.#ensureNotClosed();
    const resolved = this.#resolver.resolve(sel);
    const visible = await this.webview.evaluate(`
      (() => {
        const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
      })()
    `) as boolean;

    if (!visible) {
      throw new ElementNotFoundError(`Element ${sel} not visible`);
    }
    return this;
  }

  async waitForLoadState(state: LoadState, opts?: { timeout?: number }): Promise<this> {
    await this.#ensureNotClosed();
    const maxTime = opts?.timeout ?? this.retryTimeout;
    const start = Date.now();

    while (Date.now() - start < maxTime) {
      const isLoaded = await this.webview.evaluate(`
        (() => {
          if (document.readyState === 'complete') return true;
          if (document.readyState === 'interactive' && '${state}' === 'domcontentloaded') return true;
          return document.readyState === '${state}';
        })()
      `) as boolean;

      if (isLoaded) {
        return this;
      }

      await Bun.sleep(50);
    }

    throw new TimeoutError(`Load state ${state} not reached within ${maxTime}ms`);
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    await this.#ensureNotClosed();
    const script = `
      (() => {
        return (${fn.toString()})();
      })()
    `;
    return this.webview.evaluate(script) as Promise<T>;
  }

  locator(sel: Selector): Locator {
    const { Locator: LocatorClass } = require("./locator.js");
    return new LocatorClass(sel, this);
  }

  async $(sel: Selector): Promise<import("./locator.js").ElementHandle | null> {
    await this.#ensureNotClosed();
    const resolved = this.#resolver.resolve(sel);
    const result = await this.webview.evaluate(`
      (() => {
        const el = document.querySelector('${resolved.css.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName,
          textContent: el.textContent,
          innerHTML: el.innerHTML,
          outerHTML: el.outerHTML,
          boundingBox: rect.width > 0 && rect.height > 0 ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
          isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none',
          isEnabled: !el.hasAttribute('disabled') && !el.hasAttribute('readonly')
        };
      })()
    `);
    return result as import("./locator.js").ElementHandle | null;
  }

  async $$(sel: Selector): Promise<import("./locator.js").ElementHandle[]> {
    await this.#ensureNotClosed();
    const resolved = this.#resolver.resolve(sel);
    return this.webview.evaluate(`
      (() => {
        const els = document.querySelectorAll('${resolved.css.replace(/'/g, "\\'")}');
        return Array.from(els).map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            textContent: el.textContent,
            innerHTML: el.innerHTML,
            outerHTML: el.outerHTML,
            boundingBox: rect.width > 0 && rect.height > 0 ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
            isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none',
            isEnabled: !el.hasAttribute('disabled') && !el.hasAttribute('readonly')
          };
        });
      })()
    `) as Promise<import("./locator.js").ElementHandle[]>;
  }

  async waitForSelector(sel: Selector, opts?: { timeout?: number }): Promise<void> {
    await this.#ensureNotClosed();
    const resolved = this.#resolver.resolve(sel);
    const maxTime = opts?.timeout ?? this.retryTimeout;
    const start = Date.now();

    while (Date.now() - start < maxTime) {
      const found = await this.webview.evaluate(`
        (() => {
          return document.querySelector('${resolved.css.replace(/'/g, "\\'")}') !== null;
        })()
      `) as boolean;

      if (found) {
        return;
      }

      await Bun.sleep(50);
    }

    throw new TimeoutError(`Selector ${sel} not found within ${maxTime}ms`);
  }

  async waitForURL(url: string | RegExp, opts?: { timeout?: number }): Promise<void> {
    await this.#ensureNotClosed();
    const maxTime = opts?.timeout ?? this.retryTimeout;
    const start = Date.now();
    const pattern = url instanceof RegExp ? url : new RegExp(url);

    while (Date.now() - start < maxTime) {
      const currentUrl = this.webview.url;
      if (pattern.test(currentUrl)) {
        return;
      }
      await Bun.sleep(50);
    }

    throw new TimeoutError(`URL ${url} not matched within ${maxTime}ms`);
  }

  async exists(sel: Selector): Promise<boolean> {
    await this.#ensureNotClosed();
    const resolved = this.#resolver.resolve(sel);
    return this.webview.evaluate(`
      (() => {
        return document.querySelector('${resolved.css.replace(/'/g, "\\'")}') !== null;
      })()
    `) as Promise<boolean>;
  }

  async waitFor(sel: Selector, opts?: { timeout?: number }): Promise<boolean> {
    await this.#ensureNotClosed();
    const maxTime = opts?.timeout ?? this.retryTimeout;
    const start = Date.now();

    while (Date.now() - start < maxTime) {
      if (await this.exists(sel)) {
        return true;
      }
      await Bun.sleep(50);
    }

    return false;
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.#ensureNotClosed();
    await Bun.sleep(ms);
  }

  async cdp(method: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.#ensureNotClosed();
    return this.webview.cdp(method, params);
  }
}