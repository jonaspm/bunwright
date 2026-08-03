import { createInterface } from "readline";

export const SKILL_REPO = "jonaspm/bunwright";
export const SKILL_NAMES = ["bunwright", "bun-webview"] as const;

export interface InitTarget {
  label: string;
  agents: string[];
  global: boolean;
}

export const TARGETS: InitTarget[] = [
  {
    label: ".agents/skills (opencode, cursor, codex, gemini-cli, ...)",
    agents: ["opencode"],
    global: false,
  },
  { label: ".claude/skills (Claude Code)", agents: ["claude-code"], global: false },
  { label: ".windsurf/skills (Windsurf)", agents: ["windsurf"], global: false },
  { label: "opencode", agents: ["opencode"], global: true },
  { label: "claude-code", agents: ["claude-code"], global: true },
  { label: "cursor", agents: ["cursor"], global: true },
  { label: "codex", agents: ["codex"], global: true },
  { label: "gemini-cli", agents: ["gemini-cli"], global: true },
  { label: "github-copilot", agents: ["github-copilot"], global: true },
  { label: "windsurf", agents: ["windsurf"], global: true },
  { label: "zed", agents: ["zed"], global: true },
  { label: "roo", agents: ["roo"], global: true },
  { label: "all global agents", agents: ["*"], global: true },
];

export function parseSelection(input: string, max: number): number[] {
  const selected: number[] = [];
  for (const raw of input.split(",")) {
    const token = raw.trim();
    if (!token) continue;
    if (!/^\d+$/.test(token)) continue;
    const index = Number(token);
    if (index < 1 || index > max) continue;
    if (!selected.includes(index)) selected.push(index);
  }
  return selected;
}

export function buildSkillCommand(selected: InitTarget[]): string[][] {
  const projectAgents = selected.filter((t) => !t.global);
  const globalAgents = selected.filter((t) => t.global);
  const commands: string[][] = [];

  if (projectAgents.length > 0) {
    commands.push(
      buildCommand(
        projectAgents.flatMap((t) => t.agents),
        false,
      ),
    );
  }

  if (globalAgents.length > 0) {
    const agents = globalAgents.some((t) => t.agents.includes("*"))
      ? ["*"]
      : globalAgents.flatMap((t) => t.agents);
    commands.push(buildCommand([...new Set(agents)], true));
  }

  return commands;
}

function buildCommand(agents: string[], global: boolean): string[] {
  const args: string[] = [
    "x",
    "skills",
    "add",
    SKILL_REPO,
    "-s",
    SKILL_NAMES[0],
    "-s",
    SKILL_NAMES[1],
    "-a",
    ...agents,
    "-y",
  ];
  if (global) args.push("-g");
  return args;
}

export function promptMultiSelect(question: string, options: InitTarget[]): Promise<number[]> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const ask = () => {
      rl.question(`${question} (comma-separated numbers, enter to cancel)\n> `, (answer) => {
        const selection = parseSelection(answer, options.length);
        if (selection.length > 0 || answer.trim() === "") {
          rl.close();
          resolve(selection);
          return;
        }
        console.error(
          `Invalid selection "${answer.trim()}". Enter numbers between 1 and ${options.length}.`,
        );
        ask();
      });
    };

    ask();
  });
}

export async function runInit(): Promise<number> {
  if (!process.stdin.isTTY) {
    console.error("bunwright init requires an interactive terminal.");
    return 1;
  }

  console.log(`Installing Bunwright skills (${SKILL_NAMES.join(", ")}) from ${SKILL_REPO}.\n`);
  console.log("Where should the skills be installed?\n");

  const projectHeader = "\u001b[1mProject:\u001b[0m";
  const globalHeader = "\u001b[1mGlobal:\u001b[0m";
  const projectLines = TARGETS.filter((t) => !t.global);
  const globalLines = TARGETS.filter((t) => t.global);

  console.log(`  ${projectHeader}`);
  projectLines.forEach((t, i) => console.log(`    ${i + 1}) ${t.label}`));
  console.log(`  ${globalHeader}`);
  globalLines.forEach((t, i) => console.log(`    ${projectLines.length + i + 1}) ${t.label}`));
  console.log("");

  const selection = await promptMultiSelect("Select install targets", TARGETS);
  if (selection.length === 0) {
    console.log("Nothing selected. Aborting.");
    return 0;
  }

  const selectedTargets = selection.map((i) => TARGETS[i - 1]);
  const commands = buildSkillCommand(selectedTargets);

  for (const argv of commands) {
    const global = argv.includes("-g");
    const agents = selectedTargets.filter((t) => t.global === global);
    console.log(
      `\nInstalling ${global ? "globally for" : "into project dirs for"} agents: ${agents
        .map((t) => t.agents.join(","))
        .join(", ")}`,
    );
    const proc = Bun.spawn([process.execPath, ...argv], {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`skills install failed with exit code ${exitCode}.`);
      return exitCode;
    }
  }

  console.log("\nDone. Bunwright skills installed.");
  return 0;
}
