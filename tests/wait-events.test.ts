import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { browser, TimeoutError } from "../src/dsl";

describe("in-page event-driven waits", () => {
  afterEach(async () => {
    await browser.close();
    browser.config({ backend: "chrome" });
  });

  test("waitForSelector resolves for an element inserted after navigation", async () => {
    browser.config({ backend: "chrome", headless: true });
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

  test("waitForSelector rejects with TimeoutError when the element never appears", async () => {
    browser.config({ backend: "chrome", headless: true });
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
  });

  describe("waitForLoadState", () => {
    let server: ReturnType<typeof Bun.serve>;

    beforeAll(() => {
      server = Bun.serve({
        port: 0,
        fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/slow") {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(
                  new Response("<html><body>loaded</body></html>", {
                    headers: { "Content-Type": "text/html" },
                  }),
                );
              }, 300);
            });
          }
          if (url.pathname === "/never-load") {
            // The main document loads, but it references a script that never
            // arrives, so the window's `load` event never fires.
            return new Response('<html><body>waiting<script src="/block"></script></body></html>', {
              headers: { "Content-Type": "text/html" },
            });
          }
          if (url.pathname === "/block") {
            // Stall forever so the load event is never reached.
            return new Promise(() => {});
          }
          return new Response("not found", { status: 404 });
        },
      });
    });

    afterAll(() => {
      server.stop();
    });

    test("resolves once a slow page finishes loading", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      await page.navigate(`http://localhost:${server.port}/slow`, { waitForLoadState: "load" });
      expect(page.webview.url).toContain("/slow");
    });

    test("rejects with TimeoutError when the page never reaches load", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      // `Bun.WebView.navigate` resolves at the load event, so we use CDP to
      // start a navigation that never fires load. CDP requires an existing
      // session, so we navigate to about:blank first.
      await page.navigate("about:blank");
      await page.cdp("Page.navigate", { url: `http://localhost:${server.port}/never-load` });

      let error: unknown;
      try {
        await page.waitForLoadState("load", { timeout: 500 });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });

  describe("Locator#waitForVisible / waitForEnabled", () => {
    const locatorPage = `
      <html>
        <body>
          <button id="show-later" style="display:none">hidden</button>
          <button id="enable-later" disabled>disabled</button>
          <button id="stay-hidden" style="display:none">never</button>
          <button id="stay-disabled" disabled>never</button>
        </body>
      </html>
    `;

    test("waitForVisible resolves when the element becomes visible", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      await page.navigate(`data:text/html,${encodeURIComponent(locatorPage)}`, {
        waitForLoadState: "load",
      });

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.getElementById("show-later");
          if (el) el.style.display = "block";
        }, 100);
      });

      const locator = page.locator("css:#show-later");
      await locator.waitForVisible({ timeout: 2000 });
      expect(await locator.isVisible()).toBe(true);
    });

    test("waitForEnabled resolves when the element becomes enabled", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      await page.navigate(`data:text/html,${encodeURIComponent(locatorPage)}`, {
        waitForLoadState: "load",
      });

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.getElementById("enable-later");
          if (el) el.removeAttribute("disabled");
        }, 100);
      });

      const locator = page.locator("css:#enable-later");
      await locator.waitForEnabled({ timeout: 2000 });
      expect(await locator.isEnabled()).toBe(true);
    });

    test("waitForVisible rejects with TimeoutError when the element stays hidden", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      await page.navigate(`data:text/html,${encodeURIComponent(locatorPage)}`, {
        waitForLoadState: "load",
      });

      const locator = page.locator("css:#stay-hidden");
      let error: unknown;
      try {
        await locator.waitForVisible({ timeout: 200 });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(TimeoutError);
    });

    test("waitForEnabled rejects with TimeoutError when the element stays disabled", async () => {
      browser.config({ backend: "chrome", headless: true });
      const page = await browser.newPage();
      await page.navigate(`data:text/html,${encodeURIComponent(locatorPage)}`, {
        waitForLoadState: "load",
      });

      const locator = page.locator("css:#stay-disabled");
      let error: unknown;
      try {
        await locator.waitForEnabled({ timeout: 200 });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });
});
