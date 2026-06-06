import { describe, expect, test, afterEach } from "bun:test";
import { SelectorResolver } from "../src/dsl/selectors";
import type { Selector } from "../src/dsl/selectors";
import { defineConfig, resolveConfig } from "../src/dsl/config";
import {
  BunwrightError,
  SelectorError,
  TimeoutError,
  ElementNotFoundError,
  BrowserError,
} from "../src/dsl/errors";

describe("SelectorResolver", () => {
  test("css: prefix passes through directly", () => {
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("css:.my-class" as Selector);
    expect(result.css).toBe(".my-class");
    expect(result.isCoordinate).toBe(false);
  });

  test("xpath: prefix passes through directly (falls back when evaluate returns null)", () => {
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("xpath://div" as Selector);
    expect(result.css).toBe("xpath=//div");
    expect(result.isCoordinate).toBe(false);
  });

  test("plain string passes through as css", () => {
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("#my-id" as Selector);
    expect(result.css).toBe("#my-id");
    expect(result.isCoordinate).toBe(false);
  });

  test("cache returns same result on repeated resolve", () => {
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);

    const result1 = resolver.resolve("css:.test" as Selector);
    const result2 = resolver.resolve("css:.test" as Selector);

    expect(result1.css).toBe(result2.css);
    expect(result1.css).toBe(".test");
  });

  test.skip("role: resolves with WebView", async () => {
    const mockView = {
      evaluate: () => "button",
    } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("role=button" as Selector);
    expect(result.css).toBe("button");
  });

  test.skip("label: resolves with WebView", async () => {
    const mockView = {
      evaluate: () => 'input[type="text"]',
    } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("label:Username" as Selector);
    expect(result.css).toBe('input[type="text"]');
  });

  test.skip("text: resolves with WebView", async () => {
    const mockView = {
      evaluate: () => "div",
    } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("text:Click me" as Selector);
    expect(result.css).toBe("div");
  });
});

describe("Config Resolution", () => {
  afterEach(() => {
    defineConfig({});
  });

  test("defineConfig returns the config", () => {
    const config = { width: 1920, height: 1080 };
    const result = defineConfig(config);
    expect(result).toEqual(config);
  });

  test("resolveConfig returns defaults when no config set", async () => {
    defineConfig({});
    const result = await resolveConfig();
    expect(result.backend).toBe("chrome");
    expect(result.width).toBe(1280);
    expect(result.height).toBe(800);
    expect(result.retryTimeout).toBe(10000);
    expect(result.console).toBe(false);
    expect(result.url).toBe("");
  });

  test("resolveConfig merges defineConfig with defaults", async () => {
    defineConfig({ width: 1920 });
    const result = await resolveConfig();
    expect(result.width).toBe(1920);
    expect(result.height).toBe(800);
    expect(result.backend).toBe("chrome");
  });
});

describe("Error Classes", () => {
  test("BunwrightError has correct name", () => {
    const error = new BunwrightError("test");
    expect(error.name).toBe("BunwrightError");
    expect(error.message).toBe("test");
    expect(error instanceof Error).toBe(true);
  });

  test("SelectorError has correct name", () => {
    const error = new SelectorError("selector failed");
    expect(error.name).toBe("SelectorError");
    expect(error.message).toBe("selector failed");
    expect(error instanceof BunwrightError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  test("TimeoutError has correct name", () => {
    const error = new TimeoutError("timed out");
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("timed out");
    expect(error instanceof BunwrightError).toBe(true);
  });

  test("ElementNotFoundError has correct name", () => {
    const error = new ElementNotFoundError("element not found");
    expect(error.name).toBe("ElementNotFoundError");
    expect(error.message).toBe("element not found");
    expect(error instanceof BunwrightError).toBe(true);
  });

  test("BrowserError has correct name", () => {
    const error = new BrowserError("browser error");
    expect(error.name).toBe("BrowserError");
    expect(error.message).toBe("browser error");
    expect(error instanceof BunwrightError).toBe(true);
  });

  test("all errors are distinct instances", () => {
    const err1 = new SelectorError("a");
    const err2 = new TimeoutError("b");
    expect(err1).not.toBe(err2);
    expect(err1.name).not.toBe(err2.name);
  });
});

describe("Chain Method Return Types", () => {
  test.skip("Page methods return this for chaining", async () => {
    // Requires actual WebView - skip for unit tests
  });

  test.skip("BrowserContext.newPage returns Page", async () => {
    // Requires actual WebView - skip for unit tests
  });
});

describe("Selector Type Validation", () => {
  test("valid css: selector compiles", () => {
    const sel: Selector = "css:#id";
    expect(sel.startsWith("css:")).toBe(true);
  });

  test("valid xpath: selector compiles", () => {
    const sel: Selector = "xpath://div[@class='test']";
    expect(sel.startsWith("xpath:")).toBe(true);
  });

  test("valid role: selector compiles", () => {
    const sel: Selector = "role:button";
    expect(sel.startsWith("role:")).toBe(true);
  });

  test("valid label: selector compiles", () => {
    const sel: Selector = "label:Username";
    expect(sel.startsWith("label:")).toBe(true);
  });

  test("valid text: selector compiles", () => {
    const sel: Selector = "text:Submit";
    expect(sel.startsWith("text:")).toBe(true);
  });

  test("plain string selector handled at runtime (TypeScript may reject)", () => {
    // Note: Selector type doesn't include plain strings, but runtime does
    // This tests that the resolver handles unprefixed strings as CSS
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("#my-id" as Selector);
    expect(result.css).toBe("#my-id");
  });

  test("role with name syntax handled at runtime", () => {
    // role:role[name='value'] syntax - when evaluate returns null, fallback includes name
    const mockView = { evaluate: () => null } as any;
    const resolver = new SelectorResolver(mockView);
    const result = resolver.resolve("role:button[name='Submit']" as Selector);
    expect(result.css).toContain("button");
    expect(result.isCoordinate).toBe(false);
  });
});
