import { describe, expect, test } from "bun:test";

const cliPath = new URL("../factuclaw-cli.ts", import.meta.url);
const cliFilePath = Bun.fileURLToPath(cliPath);

describe("factuclaw CLI", () => {
  test("shows help output", async () => {
    const proc = Bun.spawn(["bun", cliFilePath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("bunx factuclaw-cli.ts --file instructions.json");
    expect(stdout).toContain("--instructions");
  });

  test("returns structured validation errors for invalid documents", async () => {
    const proc = Bun.spawn(["bun", cliFilePath, "--instructions", "{}"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    const output = JSON.parse(stderr);

    expect(exitCode).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error.code).toBe("VALIDATION_ERROR");
    expect(output.error.message).toContain("`steps` must be an array");
  });

  test("returns structured argument errors when both input modes are provided", async () => {
    const proc = Bun.spawn(["bun", cliFilePath, "--file", "instructions.json", "--instructions", "{}"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    const output = JSON.parse(stderr);

    expect(exitCode).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error.code).toBe("ARGUMENT_ERROR");
    expect(output.error.message).toContain("Provide exactly one of --file or --instructions");
  });
});
