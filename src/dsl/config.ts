/**
 * Bunwright browser configuration.
 *
 * On Windows, `Bun.WebView` has a known issue spawning its own Chrome
 * subprocess. To work around it, bunwright automatically launches Chrome
 * itself with `--remote-debugging-port` and connects via the resulting
 * WebSocket URL. In that mode, `backend.path` and `backend.argv` are
 * ignored — the workaround overrides them with the externally-spawned
 * Chrome's `webSocketDebuggerUrl`.
 */
export interface BrowserConfig {
  backend?: "webkit" | "chrome" | { type: "chrome"; path?: string; argv?: string[] };
  width?: number;
  height?: number;
  url?: string;
  console?: boolean;
  dataStore?: "ephemeral" | string;
  retryTimeout?: number;
  /**
   * When true, the externally-spawned Chrome (Windows workaround) runs in
   * `--headless=new`. When false, it runs in headed mode. Defaults to true
   * on Windows, false elsewhere.
   */
  headless?: boolean;
}

const DEFAULT_CONFIG: Required<Omit<BrowserConfig, "dataStore">> & {
  dataStore: BrowserConfig["dataStore"];
} = {
  backend: "chrome",
  width: 1280,
  height: 800,
  retryTimeout: 10000,
  console: false,
  url: "",
  headless: process.platform === "win32",
  dataStore: undefined,
};

let userConfig: BrowserConfig | undefined;

export function defineConfig(config: BrowserConfig): BrowserConfig {
  userConfig = config;
  return config;
}

export async function resolveConfig(): Promise<
  Required<BrowserConfig> & { dataStore: BrowserConfig["dataStore"] }
> {
  const defaults = { ...DEFAULT_CONFIG };
  const fileConfigs = ["bunwright.config.ts", "bunwright.config.js", "bunwright.config.mjs"];

  for (const file of fileConfigs) {
    try {
      const mod = await import(`file://${process.cwd()}/${file}`);
      const fileConfig = mod.default ?? mod;
      if (fileConfig && typeof fileConfig === "object") {
        Object.assign(defaults, fileConfig);
        break;
      }
    } catch {
      // ignore missing/invalid config files
    }
  }

  if (userConfig) {
    Object.assign(defaults, userConfig);
  }

  return defaults as Required<BrowserConfig> & { dataStore: BrowserConfig["dataStore"] };
}
