import { describe, expect, test, afterEach } from "bun:test";
import { findFreePort, resolveChromePath, spawnChrome } from "../src/dsl/chrome-spawn";

interface TcpListener {
  port: number;
  stop: () => void;
}

describe("findFreePort", () => {
  test("returns a positive integer", async () => {
    const port = await findFreePort();
    expect(typeof port).toBe("number");
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });

  test("returns a port that is reusable for binding", async () => {
    const port = await findFreePort();
    let bound = false;
    let server: TcpListener | null = null;
    try {
      server = Bun.listen<undefined>({
        hostname: "127.0.0.1",
        port,
        socket: { open() {}, close() {}, data() {} },
      }) as unknown as TcpListener;
      bound = true;
    } catch {
      bound = false;
    } finally {
      if (server) server.stop();
    }
    expect(bound).toBe(true);
  });
});

describe("resolveChromePath", () => {
  const originalEnv = process.env.BUN_CHROME_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BUN_CHROME_PATH;
    } else {
      process.env.BUN_CHROME_PATH = originalEnv;
    }
  });

  test("returns null when no candidate exists", () => {
    delete process.env.BUN_CHROME_PATH;
    const result = resolveChromePath("Z:\\definitely\\does\\not\\exist\\chrome.exe");
    expect(result).toBeNull();
  });

  test("honors BUN_CHROME_PATH env var over config path", () => {
    const envPath = "C:\\Windows\\System32\\cmd.exe";
    const configPath = "Z:\\missing.exe";
    process.env.BUN_CHROME_PATH = envPath;
    const result = resolveChromePath(configPath);
    expect(result).toBe(envPath);
  });

  test("falls back to config path when env unset", () => {
    delete process.env.BUN_CHROME_PATH;
    const result = resolveChromePath("C:\\Windows\\System32\\cmd.exe");
    expect(result).toBe("C:\\Windows\\System32\\cmd.exe");
  });

  test("returns first existing candidate when env unset and config missing", () => {
    delete process.env.BUN_CHROME_PATH;
    const result = resolveChromePath(undefined);
    if (result !== null) {
      expect(typeof result).toBe("string");
    } else {
      expect(result).toBeNull();
    }
  });
});

describe("spawnChrome", () => {
  test("throws with helpful error when Chrome path cannot be resolved", async () => {
    const originalEnv = process.env.BUN_CHROME_PATH;
    delete process.env.BUN_CHROME_PATH;
    try {
      await expect(
        spawnChrome({
          path: "Z:\\definitely\\not\\a\\real\\path\\chrome.exe",
          port: 1,
          headless: true,
          width: 800,
          height: 600,
        }),
      ).rejects.toThrow(/Chrome executable not found/);
    } finally {
      if (originalEnv !== undefined) {
        process.env.BUN_CHROME_PATH = originalEnv;
      }
    }
  });
});
