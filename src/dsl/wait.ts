/**
 * Build a single in-page async wait.
 *
 * The returned script evaluates (via `webview.evaluate`, which awaits returned
 * promises) to `Promise<boolean>`: it resolves `true` as soon as `conditionExpr`
 * — a JavaScript expression evaluated in the page that yields a boolean — becomes
 * truthy, or `false` once `timeoutMs` elapses.
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
      const check = () => { try { return !!(${conditionExpr}); } catch { return false; } };
      if (check()) return resolve(true);
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; cleanup(); resolve(value); };
      const observer = new MutationObserver(() => { if (check()) finish(true); });
      observer.observe(document, { childList: true, subtree: true, attributes: true });
      const interval = setInterval(() => { if (check()) finish(true); }, 30);
      const timer = setTimeout(() => finish(false), ${timeoutMs});
      function cleanup() { observer.disconnect(); clearInterval(interval); clearTimeout(timer); }
    }))()
  `;
}
