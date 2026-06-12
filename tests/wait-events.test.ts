import { afterEach, describe, expect, test } from "bun:test";
import { browser, TimeoutError } from "../src/dsl";

// The wait primitives (waitForSelector / waitForLoadState / Locator visibility)
// resolve via a single in-page evaluate that watches the DOM, instead of a
// host-side 50ms poll loop. WebKit is only available on macOS, so this is
// darwin-gated and uses the webkit backend.
const testDarwin = process.platform === "darwin" ? test : test.skip;

describe("in-page event-driven waits", () => {
  afterEach(async () => {
    await browser.close();
    browser.config({ backend: "chrome" });
  });

  testDarwin("waitForSelector resolves for an element inserted after navigation", async () => {
    browser.config({ backend: "webkit" });
    const page = await browser.newPage();
    await page.navigate("https://example.com", { waitForLoadState: "load" });

    // Schedule a late insertion; evaluate returns immediately after scheduling.
    await page.evaluate(() => {
      setTimeout(() => {
        const el = document.createElement("div");
        el.id = "bw-late";
        document.body.appendChild(el);
      }, 30);
    });

    // Must resolve once the MutationObserver sees the inserted node.
    await page.waitForSelector("css:#bw-late", { timeout: 2000 });
    expect(await page.exists("css:#bw-late")).toBe(true);
  });

  testDarwin(
    "waitForSelector rejects with TimeoutError when the element never appears",
    async () => {
      browser.config({ backend: "webkit" });
      const page = await browser.newPage();
      await page.navigate("https://example.com", { waitForLoadState: "load" });

      // Page methods return bunwright's chainable proxy (a thenable, not a native
      // Promise), so assert the rejection via an explicit await/catch.
      let error: unknown;
      try {
        await page.waitForSelector("css:#never-exists", { timeout: 150 });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(TimeoutError);
    },
  );
});
