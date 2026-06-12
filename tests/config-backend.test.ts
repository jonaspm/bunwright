import { afterEach, describe, expect, test } from "bun:test";
import { browser } from "../src/dsl";

// Regression test for: `browser.config(...)` was silently ignored because
// `#ensureView()` built the WebView from `resolveConfig()` alone and never
// merged the instance config. As a result `config({ backend: "webkit" })`
// still launched the default ("chrome") backend.
//
// WebKit is only available via Bun.WebView on macOS, so this is darwin-gated.
const testDarwin = process.platform === "darwin" ? test : test.skip;

describe("browser.config() is applied at runtime", () => {
  afterEach(async () => {
    await browser.close();
    // Restore the default backend so the shared singleton does not leak the
    // webkit selection into other suites.
    browser.config({ backend: "chrome" });
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
});
