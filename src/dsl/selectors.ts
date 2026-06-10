import type { WebView } from "bun";

export type Selector =
  | `role:${string}`
  | `label:${string}`
  | `text:${string}`
  | `css:${string}`
  | `xpath:${string}`;

export type LoadState = "load" | "domcontentloaded" | "networkidle";

export interface ResolvedSelector {
  css: string;
  isCoordinate: boolean;
  x?: number;
  y?: number;
}

/**
 * Convert a URL glob pattern to an anchored RegExp (Playwright semantics):
 * `**` matches any characters, `*` matches anything except `/`,
 * `?` matches a single non-`/` character.
 */
export function globToRegex(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i++;
      } else {
        source += "[^/]*";
      }
    } else if (ch === "?") {
      source += "[^/]";
    } else {
      source += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    }
  }
  return new RegExp(`^${source}$`);
}

export class SelectorResolver {
  static #cache = new WeakMap<WebView, Map<string, string>>();

  constructor(private view: WebView) {}

  async resolve(sel: Selector): Promise<ResolvedSelector> {
    const cache = SelectorResolver.#cache.get(this.view) ?? new Map<string, string>();
    if (cache.has(sel)) {
      return { css: cache.get(sel)!, isCoordinate: false };
    }

    const resolved = await this.#resolveInternal(sel);
    cache.set(sel, resolved.css);
    SelectorResolver.#cache.set(this.view, cache);

    return resolved;
  }

  async #resolveInternal(sel: Selector): Promise<ResolvedSelector> {
    if (sel.startsWith("css:")) {
      return { css: sel.slice(4), isCoordinate: false };
    }

    if (sel.startsWith("role:")) {
      return this.#resolveRole(sel.slice(5));
    }

    if (sel.startsWith("label:")) {
      return this.#resolveLabel(sel.slice(6));
    }

    if (sel.startsWith("text:")) {
      return this.#resolveText(sel.slice(5));
    }

    if (sel.startsWith("xpath:")) {
      return this.#resolveXpath(sel.slice(6));
    }

    return { css: sel, isCoordinate: false };
  }

  // Accepts `role` or `role[name='value']` / `role[name="value"]`.
  async #resolveRole(expr: string): Promise<ResolvedSelector> {
    const match = expr.match(/^([\w-]+)(?:\[name=(['"])(.*)\2\])?$/);
    const role = match?.[1] ?? expr;
    const name = match?.[3];

    const script = `(() => {
      const IMPLICIT = {
        button: 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]',
        link: 'a[href], [role="link"]',
        textbox: 'input:not([type]), input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], textarea, [role="textbox"]',
        checkbox: 'input[type="checkbox"], [role="checkbox"]',
        radio: 'input[type="radio"], [role="radio"]',
        heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
        list: 'ul, ol, [role="list"]',
        listitem: 'li, [role="listitem"]',
        img: 'img, [role="img"]',
        status: '[role="status"], output',
        combobox: 'select, [role="combobox"]',
      };
      const role = ${JSON.stringify(role)};
      const name = ${JSON.stringify(name ?? null)};
      const selector = IMPLICIT[role] ?? '[role="' + role + '"]';
      const accessibleName = (el) => {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria.trim();
        if (el instanceof HTMLInputElement) return (el.value || '').trim();
        return (el.textContent || '').trim();
      };
      const els = Array.from(document.querySelectorAll(selector));
      const el = name === null ? els[0] : els.find((e) => accessibleName(e) === name.trim());
      if (!el) return null;
      const path = [];
      let cur = el;
      while (cur && cur !== document.body) {
        const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName);
        const idx = siblings.indexOf(cur);
        const tag = cur.tagName.toLowerCase();
        path.unshift(idx > 0 ? tag + ':nth-of-type(' + (idx + 1) + ')' : tag);
        cur = cur.parentElement;
      }
      return path.join(' > ');
    })()`;

    const result = (await this.view.evaluate(script)) as string | null;
    return { css: result ?? `[role="${role}"]`, isCoordinate: false };
  }

  async #resolveLabel(labelText: string): Promise<ResolvedSelector> {
    const script = `(() => { const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim() === "${labelText}"); if (!label) return null; const forAttr = label.getAttribute('for'); if (forAttr) { const input = document.getElementById(forAttr); if (input) { const path = []; let cur = input; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); } } const input = label.querySelector('input,select,textarea'); if (input) { const path = []; let cur = input; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); } return null; })()`;

    const result = (await this.view.evaluate(script)) as string | null;
    return { css: result ?? `label:has-text("${labelText}")`, isCoordinate: false };
  }

  async #resolveText(text: string): Promise<ResolvedSelector> {
    const script = `(() => { const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent.trim() === "${text}"); if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`;

    const result = (await this.view.evaluate(script)) as string | null;
    return { css: result ?? `text="${text}"`, isCoordinate: false };
  }

  async #resolveXpath(xpath: string): Promise<ResolvedSelector> {
    const script = `(() => { const result = document.evaluate(\`${xpath}\`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null); const el = result.singleNodeValue; if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`;

    const result = (await this.view.evaluate(script)) as string | null;
    return { css: result ?? `xpath=${xpath}`, isCoordinate: false };
  }
}
