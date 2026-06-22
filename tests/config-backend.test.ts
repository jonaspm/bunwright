import { afterEach, describe, expect, test } from "bun:test";
import { browser } from "../src/dsl";

// Regression tests for: `browser.config(...)` was silently ignored because
// `#ensureView()` built the WebView from `resolveConfig()` alone and never
// merged the instance config. As a result `config({ backend: "webkit" })`
// still launched the default ("chrome") backend.
//
// WebKit is only available via Bun.WebView on macOS, so the backend assertion
// is darwin-gated. A backend-agnostic viewport assertion runs wherever Chrome
// is available (including ubuntu-latest CI).
const testDarwin = process.platform === "darwin" ? test : test.skip;

const HAS_CHROME = await checkChrome();

async function checkChrome(): Promise<boolean> {
  // Different Linux distributions ship Chrome under different binary names.
  for (const bin of ["google-chrome", "google-chrome-stable", "chromium"]) {
    try {
      const proc = Bun.spawn(["which", bin], { stderr: "pipe" });
      await proc.exited;
      if (proc.exitCode === 0) return true;
    } catch {
      // try the next binary name
    }
  }
  return false;
}

const testIfChrome = HAS_CHROME ? test : test.skip;

describe("browser.config() is applied at runtime", () => {
  afterEach(async () => {
    await browser.close();
    // Restore defaults so the shared singleton does not leak the instance
    // config into other suites.
    browser.config({ backend: "chrome", width: 1280, height: 800 });
  });

  testDarwin("config({ backend: 'webkit' }) actually selects the WebKit backend", async () => {
    browser.config({ backend: "webkit" });
    const page = await browser.newPage();
    await page.navigate("https://example.com", { waitForLoadState: "load" });

    const ua = (await page.evaluate(() => navigator.userAgent)) as string;
    // A real WebKit user agent (AppleWebKit/6xx), not the Chromium-compat one
    // (AppleWebKit/537.36 ... Chrome/...) — proves the instance config was
    // honored rather than falling back to the default "chrome" backend.
    expect(ua).not.toContain("Chrome/");
    expect(ua).not.toContain("537.36");
    expect(ua).toContain("AppleWebKit/");
  });

  testIfChrome("config({ width: 999, height: 600 }) sets the WebView viewport", async () => {
    browser.config({ width: 999, height: 600 });
    const page = await browser.newPage();
    await page.navigate("data:text/html,", { waitForLoadState: "load" });

    const [clientWidth, clientHeight] = (await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
    ])) as [number, number];
    // Allow a tolerance for Chrome UI chrome / platform rendering differences.
    // The regression where instance config is silently ignored yields ~200px
    // gaps (default 1280x800 vs configured 999x600), well above this tolerance.
    expect(
      Math.abs(clientWidth - 999),
      `expected viewport width ~999, got ${clientWidth}`,
    ).toBeLessThanOrEqual(10);
    // Height is more sensitive to Chrome UI chrome differences across
    // platforms (especially Linux runners). Use a larger tolerance that still
    // catches the original ~200px regression where the config was ignored.
    expect(
      Math.abs(clientHeight - 600),
      `expected viewport height ~600, got ${clientHeight}`,
    ).toBeLessThanOrEqual(100);
  });
});
