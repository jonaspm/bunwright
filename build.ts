import { build, type BunPlugin } from "bun";
import { readFileSync, rmSync, existsSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const distDir = "./dist";

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}

const result = await build({
  entrypoints: ["./src/bunwright.ts"],
  outdir: distDir,
  target: "bun",
  format: "esm",
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  banner: "#!/usr/bin/env bun",
  naming: "[name].mjs",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

for (const log of result.logs) {
  console.log(log);
}

console.log("Build complete.");
