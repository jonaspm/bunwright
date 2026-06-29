import { describe, expect, test } from "bun:test";
import { pathToFileURL } from "url";

const skillPath = new URL("../../../.agents/skills/bun-webview/SKILL.md", import.meta.url);
const bunTypesPath = pathToFileURL(require.resolve("bun-types/bun.d.ts"));

const [skillText, bunTypesText] = await Promise.all([
  Bun.file(skillPath).text(),
  Bun.file(bunTypesPath).text(),
]);

describe("Bun WebView skill accuracy", () => {
  test("uses the current history method names", () => {
    expect(bunTypesText).toContain("back(): Promise<void>;");
    expect(bunTypesText).toContain("forward(): Promise<void>;");

    expect(skillText).toContain("`back()`");
    expect(skillText).toContain("`forward()`");
    expect(skillText).not.toContain("`goBack()`");
    expect(skillText).not.toContain("`goForward()`");
  });

  test("does not describe unsupported inline HTML constructor options", () => {
    expect(bunTypesText).toContain("interface ConstructorOptions {");
    expect(bunTypesText).toContain("url?: string;");

    expect(skillText).not.toContain("const webview = new WebView({");
    expect(skillText).not.toContain("html: `");
    expect(skillText).not.toContain('title: "Inline HTML"');
    expect(skillText).not.toContain("webview.run()");
  });

  test("documents console capture with supported types", () => {
    expect(bunTypesText).toContain(
      "type ConsoleCapture = typeof console | ((type: string, ...args: unknown[]) => void);",
    );

    expect(skillText).toContain("globalThis.console");
    expect(skillText).toContain("(type, ...args) => void");
    expect(skillText).not.toContain("console: true");
    expect(skillText).not.toContain("`boolean` or console-like handler");
  });

  test("explains that evaluate requires an expression", () => {
    expect(bunTypesText).toContain("`script` must be an expression.");

    expect(skillText).toContain("expression");
    expect(skillText).toContain("IIFE");
    expect(skillText).not.toMatch(
      /await view\.evaluate\(\s*`\s*document\.body\.style\.background/m,
    );
  });
});
