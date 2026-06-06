export interface BrowserConfig {
  backend?: "webkit" | "chrome" | { type: "chrome"; path?: string; argv?: string[] };
  width?: number;
  height?: number;
  url?: string;
  console?: boolean;
  dataStore?: "ephemeral" | string;
  retryTimeout?: number;
}

const DEFAULT_CONFIG: Required<Omit<BrowserConfig, "dataStore">> & { dataStore: BrowserConfig["dataStore"] } = {
  backend: "chrome",
  width: 1280,
  height: 800,
  retryTimeout: 10000,
  console: false,
  url: "",
  dataStore: undefined,
};

let _config: BrowserConfig | undefined;

export function defineConfig(config: BrowserConfig): BrowserConfig {
  _config = config;
  return config;
}

export async function resolveConfig(): Promise<Required<BrowserConfig> & { dataStore: BrowserConfig["dataStore"] }> {
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

  if (_config) {
    Object.assign(defaults, _config);
  }

  return defaults as Required<BrowserConfig> & { dataStore: BrowserConfig["dataStore"] };
}