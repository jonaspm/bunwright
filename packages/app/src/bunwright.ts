import { resolve } from "path";

async function loadEnv(): Promise<void> {
  for (const filename of [".env.local", ".env"]) {
    const file = Bun.file(filename);
    if (!(await file.exists())) continue;

    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        const hashIdx = value.indexOf(" #");
        if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

await loadEnv();

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: bunwright <script.ts>");
  process.exit(1);
}

const scriptPath = resolve(args[0]);

try {
  const mod = await import(scriptPath);

  if (mod.default && typeof mod.default === "function") {
    await mod.default();
  }

  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
