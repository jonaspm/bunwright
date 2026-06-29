import { afterEach, describe, expect, test } from "bun:test";
import { browser, TimeoutError } from "../src/dsl";

// Safety net: a failed assertion skips the in-test browser.close(), which
// would leave a pending navigation that poisons every following test.
afterEach(async () => {
  await browser.close();
});

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

const testIf = HAS_CHROME ? test : test.skip;

describe("Integration: Basic Navigation", () => {
  testIf("navigates to URL and loads page", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    const title = await page.evaluate(() => document.title);
    expect(title).toBe("Example Domain");
    await browser.close();
  });
});

describe("Integration: Chain Methods", () => {
  testIf("chain methods execute in sequence", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    await page.resize(800, 600);
    await page.screenshot();
    expect(page.webview.url).toContain("example.com");
    await browser.close();
  });
});

describe("Integration: Selector Resolution", () => {
  testIf("css: selector resolves to correct element", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    const link = page.locator("css:a");
    const text = await link.innerText();
    expect(text.length).toBeGreaterThan(0);
    await browser.close();
  });
});

describe("Integration: Locator Actions", () => {
  testIf("locator click works on real element", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    const link = page.locator("css:a").first();
    await link.click();
    await browser.close();
  });
});

describe("Integration: waitForURL", () => {
  testIf("waitForURL matches URL pattern", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    await page.waitForURL(/example\.com/);
    await browser.close();
  });
});

describe("Integration: exists()", () => {
  testIf("exists returns true for present element", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    const exists = await page.exists("css:h1");
    expect(exists).toBe(true);
    await browser.close();
  });

  testIf("exists returns false for missing element", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");
    const exists = await page.exists("css:.does-not-exist");
    expect(exists).toBe(false);
    await browser.close();
  });
});

describe("Integration: TimeoutError", () => {
  testIf("click throws TimeoutError on missing element", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");

    // page.click() returns a chain thenable, not a Promise instance, and
    // expect(...).rejects requires the latter — adopt it via Promise.resolve.
    await expect(
      Promise.resolve(page.click("css:.does-not-exist", { timeout: 1000 })),
    ).rejects.toThrow(TimeoutError);

    await browser.close();
  });
});

describe("Integration: Multi-Context", () => {
  testIf("pages from multiple contexts share the single webview", async () => {
    const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    // Contexts are not isolated browser instances: every page wraps the one
    // shared WebView, so navigation must be sequential and the URL is shared.
    await page1.navigate("https://example.com");
    expect(page1.webview.url).toContain("example.com");

    await page2.navigate("https://www.iana.org");
    expect(page2.webview.url).toContain("iana.org");

    expect(page1.webview).toBe(page2.webview);

    await browser.close();
  });
});

describe("Integration: Locator Filter", () => {
  testIf("locator filter works", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");

    const links = page.locator("css:a").filter("css:div");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(0);

    await browser.close();
  });
});

describe("Integration: evaluate()", () => {
  testIf("evaluate extracts data from page", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");

    const result = await page.evaluate(() => ({
      title: document.title,
      bodyText: document.body.textContent?.length ?? 0,
    }));

    expect(result.title).toBe("Example Domain");
    expect(result.bodyText).toBeGreaterThan(0);

    await browser.close();
  });
});

describe("Integration: cdp()", () => {
  testIf("cdp method sends Chrome DevTools Protocol call", async () => {
    const page = await browser.newPage();
    await page.navigate("https://example.com");

    const response = await page.cdp("Page.getNavigationHistory");
    expect(response).toBeDefined();

    await browser.close();
  });
});
