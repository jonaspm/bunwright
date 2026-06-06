import { fileURLToPath } from "url";
import { resolve } from "path";

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
