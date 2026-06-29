export interface InPageWaitResult {
  ok: boolean;
  error?: string;
  expression?: string;
}

/**
 * Build a single in-page async wait.
 *
 * The returned script evaluates (via `webview.evaluate`, which awaits returned
 * promises) to `Promise<InPageWaitResult>`: it resolves `{ ok: true }` as soon
 * as `conditionExpr` — a JavaScript expression evaluated in the page that
 * yields a boolean — becomes truthy, or `{ ok: false }` once `timeoutMs`
 * elapses. If the condition expression throws, the last error is included so
 * callers can distinguish a genuine timeout from a malformed expression.
 *
 * This replaces host-side polling (one IPC round-trip per 50ms tick) with a
 * single round-trip. Inside the page the condition is checked immediately, on
 * every DOM mutation (via `MutationObserver`), and on a cheap in-page interval
 * as a fallback for state changes a mutation observer does not see — e.g.
 * `document.readyState` transitions or layout-driven visibility. In-page checks
 * cost nothing across the IPC boundary, so the up-to-50ms latency floor and the
 * repeated `evaluate` round-trips are both removed.
 */
export function inPageWaitScript(conditionExpr: string, timeoutMs: number): string {
  return `
    (() => new Promise((resolve) => {
      const conditionExpr = ${JSON.stringify(conditionExpr)};
      let lastError = null;
      const check = () => {
        try {
          // new Function() is eval-equivalent: like the original inline
          // interpolation it throws under a strict script-src CSP. Accepted
          // tradeoff — there is no CSP-safe way to run an arbitrary
          // caller-supplied condition expression in-page.
          return Boolean(new Function("return (" + conditionExpr + ")")());
        } catch (err) {
          lastError = String(err);
          return false;
        }
      };
      if (check()) return resolve({ ok: true });
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; cleanup(); resolve(value); };
      const observer = new MutationObserver(() => { if (check()) finish({ ok: true }); });
      observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
      const interval = setInterval(() => { if (check()) finish({ ok: true }); }, 50);
      const timer = setTimeout(() => finish({ ok: false, error: lastError, expression: conditionExpr }), ${timeoutMs});
      function cleanup() { observer.disconnect(); clearInterval(interval); clearTimeout(timer); }
    }))()
  `;
}
