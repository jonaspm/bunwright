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

export class SelectorResolver {
  static #cache = new WeakMap<WebView, Map<string, string>>();

  constructor(private view: WebView) {}

  resolve(sel: Selector): ResolvedSelector {
    const cache = SelectorResolver.#cache.get(this.view) ?? new Map<string, string>();
    if (cache.has(sel)) {
      return { css: cache.get(sel)!, isCoordinate: false };
    }

    const resolved = this.#resolveInternal(sel);
    cache.set(sel, resolved.css);
    SelectorResolver.#cache.set(this.view, cache);

    return resolved;
  }

  #resolveInternal(sel: Selector): ResolvedSelector {
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

  #resolveRole(expr: string): ResolvedSelector {
    const eqIndex = expr.indexOf("=");
    const [role, name] = eqIndex !== -1
      ? [expr.slice(0, eqIndex), expr.slice(eqIndex + 2, -1)]
      : [expr, undefined];

    const script = name !== undefined
      ? `(() => { const el = document.querySelector('[role="${role}"][aria-label="${name}"]') ?? document.querySelector('[role="${role}"]'); if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`
      : `(() => { const el = document.querySelector('[role="${role}"]'); if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`;

    const result = this.view.evaluate(script) as unknown as string | null;
    return { css: result ?? `[role="${role}"]`, isCoordinate: false };
  }

  #resolveLabel(labelText: string): ResolvedSelector {
    const script = `(() => { const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim() === "${labelText}"); if (!label) return null; const forAttr = label.getAttribute('for'); if (forAttr) { const input = document.getElementById(forAttr); if (input) { const path = []; let cur = input; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); } } const input = label.querySelector('input,select,textarea'); if (input) { const path = []; let cur = input; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); } return null; })()`;

    const result = this.view.evaluate(script) as unknown as string | null;
    return { css: result ?? `label:has-text("${labelText}")`, isCoordinate: false };
  }

  #resolveText(text: string): ResolvedSelector {
    const script = `(() => { const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent.trim() === "${text}"); if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`;

    const result = this.view.evaluate(script) as unknown as string | null;
    return { css: result ?? `text="${text}"`, isCoordinate: false };
  }

  #resolveXpath(xpath: string): ResolvedSelector {
    const script = `(() => { const result = document.evaluate(\`${xpath}\`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null); const el = result.singleNodeValue; if (!el) return null; const path = []; let cur = el; while (cur && cur !== document.body) { const siblings = Array.from(cur.parentElement?.children ?? []).filter(c => c.tagName === cur.tagName); const idx = siblings.indexOf(cur); const tag = cur.tagName.toLowerCase(); path.unshift(idx > 0 ? \`\${tag}:nth-of-type(\${idx + 1})\` : tag); cur = cur.parentElement; } return path.join(' > '); })()`;

    const result = this.view.evaluate(script) as unknown as string | null;
    return { css: result ?? `xpath=${xpath}`, isCoordinate: false };
  }
}