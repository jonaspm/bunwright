import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

interface TcpListener {
  port: number;
  stop: () => void;
  ref?: () => void;
  unref?: () => void;
}

export interface ChromeSpawnOptions {
  path?: string;
  port: number;
  headless: boolean;
  width: number;
  height: number;
  dataStore?: { directory: string } | "ephemeral" | undefined;
  env?: Record<string, string | undefined>;
  spawnTimeoutMs?: number;
}

export interface ChromeSpawnHandle {
  webSocketDebuggerUrl: string;
  port: number;
  pid: number | null;
  kill: () => void;
}

const DEFAULT_WINDOWS_PATHS = [
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
  String.raw`%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`,
  String.raw`%ProgramFiles%\Google\Chrome\Application\chrome.exe`,
  String.raw`%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe`,
];

function expandEnv(value: string): string {
  return value.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_, name) => {
    const v = process.env[name];
    return v == null ? "" : v;
  });
}

export function resolveChromePath(configPath?: string): string | null {
  const envPath = process.env.BUN_CHROME_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  if (configPath) candidates.push(configPath);
  for (const raw of DEFAULT_WINDOWS_PATHS) {
    const expanded = expandEnv(raw);
    if (expanded) candidates.push(expanded);
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    let server: TcpListener | null = null;
    try {
      server = Bun.listen<undefined>({
        hostname: "127.0.0.1",
        port: 0,
        socket: {
          open() {},
          close() {},
          data() {},
        },
      });
      if (!server) {
        reject(new Error("Bun.listen returned a null server"));
        return;
      }
      const port = server.port;
      server.stop();
      resolvePort(port);
    } catch (err) {
      if (server) {
        try {
          server.stop();
        } catch {}
      }
      reject(err);
    }
  });
}

async function pollJsonVersion(
  port: number,
  timeoutMs: number,
): Promise<{ webSocketDebuggerUrl: string }> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}/json/version`;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          return { webSocketDebuggerUrl: data.webSocketDebuggerUrl };
        }
      }
      lastErr = new Error(`status ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await Bun.sleep(100);
  }
  throw new Error(
    `Chrome did not start responding on port ${port} within ${timeoutMs}ms (last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    })`,
  );
}

let activeHandle: ChromeSpawnHandle | null = null;
let exitHookInstalled = false;

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  const cleanup = () => {
    if (activeHandle) {
      try {
        activeHandle.kill();
      } catch {}
      activeHandle = null;
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
}

export async function spawnChrome(opts: ChromeSpawnOptions): Promise<ChromeSpawnHandle> {
  const path = resolveChromePath(opts.path);
  if (!path) {
    throw new Error(
      "Chrome executable not found. Set BUN_CHROME_PATH or config.backend.path, or install Chrome/Chromium.",
    );
  }

  const userDataDir =
    opts.dataStore && typeof opts.dataStore === "object"
      ? opts.dataStore.directory
      : mkdtempSync(join(tmpdir(), "bunwright-chrome-"));

  const args: string[] = [];
  if (opts.headless) {
    args.push("--headless=new");
  }
  args.push(`--remote-debugging-port=${opts.port}`);
  args.push("--remote-debugging-address=127.0.0.1");
  args.push("--no-first-run");
  args.push("--no-default-browser-check");
  args.push("--disable-gpu");
  args.push(`--user-data-dir=${userDataDir}`);
  args.push(`--window-size=${opts.width},${opts.height}`);

  const proc = Bun.spawn([path, ...args], {
    stdout: "ignore",
    stderr: "ignore",
    env: {
      ...process.env,
      ...opts.env,
    },
  });

  installExitHook();

  const timeout = opts.spawnTimeoutMs ?? 10_000;
  const version = await pollJsonVersion(opts.port, timeout);

  const handle: ChromeSpawnHandle = {
    webSocketDebuggerUrl: version.webSocketDebuggerUrl,
    port: opts.port,
    pid: typeof proc.pid === "number" ? proc.pid : null,
    kill: () => {
      try {
        proc.kill();
      } catch {}
      if (typeof opts.dataStore === "object" && opts.dataStore?.directory === userDataDir) {
        // keep persistent dataStore
      } else {
        try {
          rmSync(userDataDir, { recursive: true, force: true });
        } catch {}
      }
    },
  };

  activeHandle = handle;
  return handle;
}

export function disposeChromeHandle(): void {
  if (activeHandle) {
    try {
      activeHandle.kill();
    } catch {}
    activeHandle = null;
  }
}
