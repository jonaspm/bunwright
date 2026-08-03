import { describe, expect, test } from "bun:test";
import { TARGETS, buildSkillCommand, parseSelection } from "../src/init.js";

describe("parseSelection", () => {
  test("parses comma-separated numbers", () => {
    expect(parseSelection("1,3,5", 10)).toEqual([1, 3, 5]);
  });

  test("trims whitespace", () => {
    expect(parseSelection(" 1 , 2 ,4 ", 10)).toEqual([1, 2, 4]);
  });

  test("ignores out-of-range and non-numeric tokens", () => {
    expect(parseSelection("0,11,foo,2", 10)).toEqual([2]);
  });

  test("dedupes repeated selections", () => {
    expect(parseSelection("2,2,3,2", 10)).toEqual([2, 3]);
  });

  test("returns empty for empty input", () => {
    expect(parseSelection("", 10)).toEqual([]);
    expect(parseSelection("   ", 10)).toEqual([]);
  });
});

describe("buildSkillCommand", () => {
  test("single project target", () => {
    const target = TARGETS[0];
    const commands = buildSkillCommand([target]);
    expect(commands).toEqual([
      [
        "x",
        "skills",
        "add",
        "jonaspm/bunwright",
        "-s",
        "bunwright",
        "-s",
        "bun-webview",
        "-a",
        "opencode",
        "-y",
      ],
    ]);
  });

  test("single global target adds -g", () => {
    const target = TARGETS[3];
    const commands = buildSkillCommand([target]);
    expect(commands[0]).toContain("-a");
    expect(commands[0]).toContain("opencode");
    expect(commands[0]).toContain("-g");
    expect(commands[0]).not.toContain("all-agents");
  });

  test("groups project and global into separate commands", () => {
    const commands = buildSkillCommand([TARGETS[0], TARGETS[3]]);
    expect(commands).toHaveLength(2);
    expect(commands[0]).not.toContain("-g");
    expect(commands[1]).toContain("-g");
  });

  test("merges agents of same scope", () => {
    const commands = buildSkillCommand([TARGETS[4], TARGETS[5]]);
    expect(commands).toHaveLength(1);
    const args = commands[0];
    expect(args).toContain("claude-code");
    expect(args).toContain("cursor");
    expect(args).toContain("-g");
  });

  test("all-global-agents shortcut collapses to '*'", () => {
    const commands = buildSkillCommand([TARGETS[3], TARGETS[12]]);
    expect(commands).toHaveLength(1);
    const args = commands[0];
    const agentArgs = args.slice(args.indexOf("-a") + 1);
    const flags = ["-y", "-g"];
    const agents = agentArgs.filter((a) => !flags.includes(a));
    expect(agents).toEqual(["*"]);
  });

  test("no targets produces no commands", () => {
    expect(buildSkillCommand([])).toEqual([]);
  });
});
