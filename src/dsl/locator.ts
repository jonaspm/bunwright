import type { WebView } from "bun";
import type { Selector } from "./selectors.js";
import { SelectorResolver } from "./selectors.js";
import { TimeoutError, ElementNotFoundError } from "./errors.js";

interface Page {
  webview: WebView;
  retryTimeout: number;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 100;

function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

function getBackoffDelay(attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
}

export class ElementHandle {
  constructor(
    private cssSelector: string,
    private page: Page,
  ) {}

  private get webview(): WebView {
    return this.page.webview;
  }

  async click(): Promise<void> {
    await this.webview.click(this.cssSelector);
  }

  async dblClick(): Promise<void> {
    await this.webview.evaluate(
      `(() => { const el = document.querySelector('${this.cssSelector}'); if (!el) return; const rect = el.getBoundingClientRect(); const x = rect.left + rect.width / 2; const y = rect.top + rect.height / 2; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y })); })()`,
    );
  }

  async type(text: string): Promise<void> {
    await this.webview.click(this.cssSelector);
    await this.webview.type(text);
  }

  async press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<void> {
    await this.webview.press(key, modifiers ? { modifiers } : undefined);
  }

  async screenshot(opts?: { path?: string }): Promise<void> {
    const image = await this.webview.screenshot({ encoding: "blob" });
    if (opts?.path) {
      await Bun.write(opts.path, image);
    }
  }

  async evaluate<T>(fn: (el: any) => T): Promise<T> {
    const script = `(() => { const el = document.querySelector('${this.cssSelector}'); if (!el) return null; return (${fn.toString()})(el); })()`;
    return this.webview.evaluate(script) as Promise<T>;
  }

  async innerText(): Promise<string> {
    const script = `document.querySelector('${this.cssSelector}')?.textContent ?? ''`;
    return this.webview.evaluate(script) as Promise<string>;
  }

  async innerHTML(): Promise<string> {
    const script = `document.querySelector('${this.cssSelector}')?.innerHTML ?? ''`;
    return this.webview.evaluate(script) as Promise<string>;
  }

  async getAttribute(name: string): Promise<string | null> {
    const script = `document.querySelector('${this.cssSelector}')?.getAttribute('${name}') ?? null`;
    return this.webview.evaluate(script) as Promise<string | null>;
  }

  async isVisible(): Promise<boolean> {
    const script = `(() => { const el = document.querySelector('${this.cssSelector}'); if (!el) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0; })()`;
    return this.webview.evaluate(script) as Promise<boolean>;
  }

  async isEnabled(): Promise<boolean> {
    const script = `(() => { const el = document.querySelector('${this.cssSelector}'); if (!el) return false; return !el.hasAttribute('disabled') && !el.hasAttribute('readonly'); })()`;
    return this.webview.evaluate(script) as Promise<boolean>;
  }
}

export class Locator {
  private selectorResolver: SelectorResolver;
  private filters: Selector[] = [];

  constructor(
    private selector: Selector,
    private page: Page,
  ) {
    this.selectorResolver = new SelectorResolver(page.webview);
  }

  getPage(): Page {
    return this.page;
  }

  private get webview(): WebView {
    return this.page.webview;
  }

  private get retryTimeout(): number {
    return this.page.retryTimeout;
  }

  resolveSelector(): string {
    let css = this.selectorResolver.resolve(this.selector).css;
    for (const filter of this.filters) {
      const filterCss = this.selectorResolver.resolve(filter).css;
      css = `${css} ${filterCss}`;
    }
    return css;
  }

  private async waitForVisible(css: string, timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const visible = (await this.webview.evaluate(
        `(() => { const el = document.querySelector('${css}'); if (!el) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0; })()`,
      )) as boolean;
      if (visible) return;
      await sleep(50);
    }
    throw new TimeoutError(`Element ${css} not visible within ${timeout}ms`);
  }

  private async waitForEnabled(css: string, timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const enabled = (await this.webview.evaluate(
        `(() => { const el = document.querySelector('${css}'); if (!el) return false; return !el.hasAttribute('disabled') && !el.hasAttribute('readonly'); })()`,
      )) as boolean;
      if (enabled) return;
      await sleep(50);
    }
    throw new TimeoutError(`Element ${css} not enabled within ${timeout}ms`);
  }

  async click(opts?: { timeout?: number }): Promise<void> {
    const timeout = opts?.timeout ?? this.retryTimeout;
    const css = this.resolveSelector();
    await this.waitForVisible(css, timeout);
    await this.waitForEnabled(css, timeout);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.webview.click(css);
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw new TimeoutError(
            `Click failed after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await sleep(getBackoffDelay(attempt));
      }
    }
  }

  async dblClick(opts?: { timeout?: number }): Promise<void> {
    const timeout = opts?.timeout ?? this.retryTimeout;
    const css = this.resolveSelector();
    await this.waitForVisible(css, timeout);
    await this.waitForEnabled(css, timeout);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.webview.evaluate(
          `(() => { const el = document.querySelector('${css}'); if (!el) return; const rect = el.getBoundingClientRect(); const x = rect.left + rect.width / 2; const y = rect.top + rect.height / 2; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y })); })()`,
        );
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw new TimeoutError(
            `DblClick failed after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await sleep(getBackoffDelay(attempt));
      }
    }
  }

  async type(text: string, opts?: { timeout?: number }): Promise<void> {
    const timeout = opts?.timeout ?? this.retryTimeout;
    const css = this.resolveSelector();
    await this.waitForVisible(css, timeout);
    await this.waitForEnabled(css, timeout);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.webview.click(css);
        await this.webview.type(text);
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw new TimeoutError(
            `Type failed after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await sleep(getBackoffDelay(attempt));
      }
    }
  }

  async fill(text: string): Promise<void> {
    const css = this.resolveSelector();
    await this.waitForVisible(css, this.retryTimeout);
    await this.waitForEnabled(css, this.retryTimeout);

    await this.webview.evaluate(
      `(() => { const el = document.querySelector('${css}'); if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) { el.value = ''; } })()`,
    );
    await this.webview.click(css);
    await this.webview.type(text);
  }

  async press(key: string, modifiers?: Bun.WebView.Modifier[]): Promise<void> {
    const css = this.resolveSelector();
    await this.waitForVisible(css, this.retryTimeout);
    await this.webview.press(key, modifiers ? { modifiers } : undefined);
  }

  async screenshot(opts?: { path?: string }): Promise<void> {
    const image = await this.webview.screenshot({ encoding: "blob" });
    if (opts?.path) {
      await Bun.write(opts.path, image);
    }
  }

  async evaluate<T>(fn: (el: any) => T): Promise<T> {
    const css = this.resolveSelector();
    const script = `(() => { const el = document.querySelector('${css}'); if (!el) return null; return (${fn.toString()})(el); })()`;
    return this.webview.evaluate(script) as Promise<T>;
  }

  async innerText(): Promise<string> {
    const css = this.resolveSelector();
    const script = `document.querySelector('${css}')?.textContent ?? ''`;
    return this.webview.evaluate(script) as Promise<string>;
  }

  async innerHTML(): Promise<string> {
    const css = this.resolveSelector();
    const script = `document.querySelector('${css}')?.innerHTML ?? ''`;
    return this.webview.evaluate(script) as Promise<string>;
  }

  async getAttribute(name: string): Promise<string | null> {
    const css = this.resolveSelector();
    const script = `document.querySelector('${css}')?.getAttribute('${name}') ?? null`;
    return this.webview.evaluate(script) as Promise<string | null>;
  }

  async isVisible(): Promise<boolean> {
    const css = this.resolveSelector();
    const script = `(() => { const el = document.querySelector('${css}'); if (!el) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0; })()`;
    return this.webview.evaluate(script) as Promise<boolean>;
  }

  async isEnabled(): Promise<boolean> {
    const css = this.resolveSelector();
    const script = `(() => { const el = document.querySelector('${css}'); if (!el) return false; return !el.hasAttribute('disabled') && !el.hasAttribute('readonly'); })()`;
    return this.webview.evaluate(script) as Promise<boolean>;
  }

  async isChecked(): Promise<boolean> {
    const css = this.resolveSelector();
    const script = `(() => { const el = document.querySelector('${css}'); if (!el) return false; return (el as HTMLInputElement).checked ?? false; })()`;
    return this.webview.evaluate(script) as Promise<boolean>;
  }

  filter(sel: Selector): Locator {
    const newLocator = new Locator(this.selector, this.page);
    newLocator.filters = [...this.filters, sel];
    return newLocator;
  }

  first(): Locator {
    return new IndexLocator(this, 0);
  }

  last(): Locator {
    return new IndexLocator(this, -1);
  }

  nth(index: number): Locator {
    return new IndexLocator(this, index);
  }

  async count(): Promise<number> {
    const css = this.resolveSelector();
    const script = `document.querySelectorAll('${css}').length`;
    return this.webview.evaluate(script) as Promise<number>;
  }

  async toElement(): Promise<ElementHandle> {
    const css = this.resolveSelector();
    await this.waitForVisible(css, this.retryTimeout);
    return new ElementHandle(css, this.page);
  }
}

class IndexLocator extends Locator {
  constructor(
    private inner: Locator,
    private index: number,
  ) {
    super("css:*" as Selector, inner.getPage());
  }

  override async toElement(): Promise<ElementHandle> {
    const css = this.inner.resolveSelector();
    const total = await this.inner.count();
    const actualIndex = this.index === -1 ? total - 1 : this.index;

    if (actualIndex < 0 || actualIndex >= total) {
      throw new ElementNotFoundError(`No element at index ${actualIndex} (count: ${total})`);
    }

    return new ElementHandle(css, this.getPage());
  }
}
