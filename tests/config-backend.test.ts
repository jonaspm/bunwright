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
  try {
    const proc = Bun.spawn(["which", "google-chrome"], { stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
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

    const [innerWidth, innerHeight] = (await page.evaluate(() => [
      window.innerWidth,
      window.innerHeight,
    ])) as [number, number];
    expect(innerWidth).toBe(999);
    expect(innerHeight).toBe(600);
  });
});
