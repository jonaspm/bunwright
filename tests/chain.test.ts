import { describe, expect, test } from "bun:test";
import { CHAINABLE, chainable, isChainable } from "../src/dsl/chain";
import { BunwrightError, TimeoutError } from "../src/dsl/errors";
import { globToRegex } from "../src/dsl/selectors";

class Widget {
  readonly [CHAINABLE] = true as const;
  calls: string[] = [];
  width = 10;

  async open(): Promise<this> {
    this.calls.push("open");
    return this;
  }

  async tap(label: string): Promise<this> {
    this.calls.push(`tap:${label}`);
    return this;
  }

  async idle(): Promise<void> {
    this.calls.push("idle");
  }

  async size(): Promise<number> {
    this.calls.push("size");
    return 42;
  }

  async boom(): Promise<this> {
    this.calls.push("boom");
    throw new TimeoutError("boom");
  }

  panel(): Panel {
    this.calls.push("panel");
    return new Panel(this);
  }

  async asyncPanel(): Promise<Panel> {
    this.calls.push("asyncPanel");
    return new Panel(this);
  }
}

class Panel {
  readonly [CHAINABLE] = true as const;

  constructor(readonly owner: Widget) {}

  async press(): Promise<void> {
    this.owner.calls.push("press");
  }

  async label(): Promise<string> {
    this.owner.calls.push("label");
    return "ok";
  }
}

function setup() {
  const widget = new Widget();
  return { widget, w: chainable(widget) };
}

describe("chainable (resting proxy)", () => {
  test("is not thenable: await returns the proxy itself", async () => {
    const { w } = setup();
    expect(await w).toBe(w);
  });

  test("is cached: same target returns same proxy", () => {
    const { widget, w } = setup();
    expect(chainable(widget)).toBe(w);
  });

  test("passes through non-function properties", () => {
    const { w } = setup();
    expect(w.width).toBe(10);
  });

  test("set trap forwards to the target", () => {
    const { widget, w } = setup();
    w.width = 20;
    expect(widget.width).toBe(20);
  });

  test("sync chainable-returning methods wrap their result", async () => {
    const { widget, w } = setup();
    const panel = w.panel();
    await panel.press();
    expect(widget.calls).toEqual(["panel", "press"]);
  });

  test("isChainable detects the marker through the proxy", () => {
    const { w } = setup();
    expect(isChainable(w)).toBe(true);
    expect(isChainable({})).toBe(false);
    expect(isChainable(null)).toBe(false);
  });
});

describe("pending chain", () => {
  test("executes queued steps sequentially in call order", async () => {
    const { widget, w } = setup();
    await w.open().tap("a").idle().tap("b");
    expect(widget.calls).toEqual(["open", "tap:a", "idle", "tap:b"]);
  });

  test("awaiting a this-returning chain resolves to the resting proxy", async () => {
    const { w } = setup();
    const result = await w.open().tap("a");
    expect(result).toBe(w);
  });

  test("void steps keep chaining on the current target", async () => {
    const { widget, w } = setup();
    const result = await w.idle().tap("x");
    expect(widget.calls).toEqual(["idle", "tap:x"]);
    expect(result).toBe(w);
  });

  test("value-returning steps terminate with the value", async () => {
    const { w } = setup();
    const n = await w.open().size();
    expect(n).toBe(42);
  });

  test("chainable results switch the chain target", async () => {
    const { widget, w } = setup();
    await w.open().asyncPanel().press();
    expect(widget.calls).toEqual(["open", "asyncPanel", "press"]);
  });

  test("value steps resolve after a target switch", async () => {
    const { w } = setup();
    const label = await w.asyncPanel().label();
    expect(label).toBe("ok");
  });

  test("chaining after a terminal value step rejects", async () => {
    const { w } = setup();
    const chain = w.size() as any;
    await expect(Promise.resolve(chain.tap("late"))).rejects.toBeInstanceOf(BunwrightError);
  });
});

describe("fail-fast", () => {
  test("steps after a failed step never execute", async () => {
    const { widget, w } = setup();
    let caught: unknown;
    try {
      await w.open().boom().tap("never");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TimeoutError);
    expect(widget.calls).toEqual(["open", "boom"]);
    expect(widget.calls).not.toContain("tap:never");
  });

  test("all() rejects with the same error", async () => {
    const { widget, w } = setup();
    await expect(w.open().boom().tap("never").all()).rejects.toBeInstanceOf(TimeoutError);
    expect(widget.calls).toEqual(["open", "boom"]);
  });
});

describe("all()", () => {
  test("resolves with each step's raw result in call order", async () => {
    const { widget, w } = setup();
    const results = await w.open().idle().size().all();
    expect(results).toEqual([widget, undefined, 42]);
    expect(results[0]).toBe(widget);
  });

  test("records target-switch results", async () => {
    const { widget, w } = setup();
    const results = await w.asyncPanel().label().all();
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Panel);
    expect(results[1]).toBe("ok");
    expect(widget.calls).toEqual(["asyncPanel", "label"]);
  });
});

describe("globToRegex", () => {
  test("** matches across slashes", () => {
    expect(globToRegex("**/secure").test("https://example.com/secure")).toBe(true);
    expect(globToRegex("**/success").test("https://example.com/a/b/success")).toBe(true);
  });

  test("* does not cross slashes", () => {
    expect(globToRegex("https://example.com/*").test("https://example.com/page")).toBe(true);
    expect(globToRegex("https://example.com/*").test("https://example.com/a/b")).toBe(false);
  });

  test("? matches a single non-slash character", () => {
    expect(globToRegex("page-?").test("page-1")).toBe(true);
    expect(globToRegex("page-?").test("page-12")).toBe(false);
    expect(globToRegex("page-?").test("page-/")).toBe(false);
  });

  test("escapes regex metacharacters", () => {
    expect(globToRegex("https://example.com/a.b").test("https://example.com/a.b")).toBe(true);
    expect(globToRegex("https://example.com/a.b").test("https://example.com/aXb")).toBe(false);
  });

  test("pattern is anchored", () => {
    expect(globToRegex("secure").test("https://example.com/secure")).toBe(false);
    expect(globToRegex("secure").test("secure")).toBe(true);
  });
});
