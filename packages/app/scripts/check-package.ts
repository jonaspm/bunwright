import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const packDirectory = await mkdtemp(join(tmpdir(), "bunwright-pack-"));
try {
  const pack = Bun.spawnSync(
    [process.execPath, "pm", "pack", "--destination", packDirectory, "--quiet"],
    { stderr: "inherit" },
  );
  if (!pack.success) throw new Error("Could not pack bunwright");

  const filename = basename(pack.stdout.toString().trim());
  const tarball = Bun.file(join(packDirectory, filename));
  const files = await new Bun.Archive(await tarball.bytes()).files();
  const manifest = files.get("package/package.json");
  if (!manifest) throw new Error("The bunwright tarball has no package.json");

  const { types } = await manifest.json();
  if (
    typeof types !== "string" ||
    !types.endsWith(".d.ts") ||
    !files.has(`package/${types.replace(/^\.\//, "")}`)
  ) {
    throw new Error(`The bunwright tarball is missing its declared types entry: ${types}`);
  }
} finally {
  await rm(packDirectory, { recursive: true, force: true });
}
