declare const __VERSION__: string;

import { command, run, string } from "@drizzle-team/brocli";
import { readFileSync } from "fs";

const CLI_VERSION = typeof __VERSION__ !== "undefined"
  ? __VERSION__
  : JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")).version;

type WebViewBackend = Bun.WebView.ConstructorOptions["backend"];

type InstructionDocument = {
  config?: InstructionConfig;
  steps: InstructionStep[];
};

type InstructionConfig = {
  backend?: WebViewBackend;
  width?: number;
  height?: number;
  url?: string;
  console?: boolean;
  dataStore?: "ephemeral" | { directory: string };
};

type ScreenshotFormat = "png" | "jpeg" | "webp";

type InstructionStep =
  | { action: "navigate"; url: string }
  | { action: "click"; selector: string }
  | { action: "click"; x: number; y: number }
  | { action: "type"; selector: string; text: string }
  | { action: "press"; key: string; modifiers?: Bun.WebView.PressOptions["modifiers"] }
  | { action: "evaluate"; script: string }
  | { action: "wait"; ms: number }
  | { action: "screenshot"; path?: string; format?: ScreenshotFormat; quality?: number }
  | { action: "scroll"; dx: number; dy: number }
  | { action: "scrollTo"; selector: string; block?: Bun.WebView.ScrollToOptions["block"] }
  | { action: "resize"; width: number; height: number }
  | { action: "back" }
  | { action: "forward" }
  | { action: "reload" };

type StepSuccessResult = {
  index: number;
  action: InstructionStep["action"];
  attempt: number;
  result?: unknown;
  screenshotPath?: string;
};

type FailureOutput = {
  ok: false;
  error: {
    code: "VALIDATION_ERROR" | "ARGUMENT_ERROR" | "STEP_FAILED";
    message: string;
    stepIndex?: number;
    stepAction?: InstructionStep["action"];
    attempts?: number;
    details?: unknown;
  };
};

const MAX_STEP_ATTEMPTS = 3;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DEFAULT_BACKEND: WebViewBackend = "chrome";
const POST_RUN_DELAY_MS = 10_000;
const CLI_NAME = "bunwright";
const CLI_DESCRIPTION = "JSON-driven Bun.WebView automation CLI";

function fail(error: FailureOutput["error"]): never {
  console.error(JSON.stringify({ ok: false, error } satisfies FailureOutput));
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

type CliOptions = {
  file?: string;
  instructions?: string;
};

function renderHelp(): string {
  return `Usage:
  ${CLI_NAME} --file instructions.json
  ${CLI_NAME} --instructions '{"steps":[...]}'

Options:
  --file <path>            Read instructions from a JSON file
  --instructions <json>    Read instructions from an inline JSON string
  --help                   Show this message
  --version                Show the CLI version`;
}

function printHelp(): void {
  console.log(renderHelp());
}

function normalizeArgumentError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Invalid CLI arguments.";
}

function formatCliError(event: {
  violation: string;
  unrecognized?: string[];
  offender?: string | { namePart?: string; dataPart?: string };
  missing?: string[][];
}): string {
  switch (event.violation) {
    case "unrecognized_args_error":
      return `Unknown argument: ${event.unrecognized?.[0] ?? "<unknown>"}`;
    case "unknown_command_error":
    case "unknown_subcommand_error":
      return `Unknown argument: ${typeof event.offender === "string" ? event.offender : "<unknown>"}`;
    case "missing_args_error":
      return `Missing required argument: ${event.missing?.[0]?.join("/") ?? "<unknown>"}`;
    case "invalid_boolean_syntax":
    case "invalid_string_syntax":
    case "invalid_number_syntax":
    case "invalid_number_value":
    case "above_max":
    case "below_min":
    case "expected_int":
    case "enum_violation": {
      const offender = typeof event.offender === "object"
        ? event.offender.namePart ?? event.offender.dataPart ?? "<unknown>"
        : event.offender;
      return `Invalid value for argument: ${offender}`;
    }
    default:
      return "Invalid CLI arguments.";
  }
}

async function loadInstructionSource(args: { file?: string; instructions?: string }): Promise<unknown> {
  const hasFile = isString(args.file);
  const hasInstructions = isString(args.instructions);

  if (hasFile === hasInstructions) {
    fail({
      code: "ARGUMENT_ERROR",
      message: "Provide exactly one of --file or --instructions.",
    });
  }

  try {
    if (hasFile) {
      const filePath = args.file;

      if (!isString(filePath)) {
        fail({
          code: "ARGUMENT_ERROR",
          message: "`--file` requires a path.",
        });
      }

      return JSON.parse(await Bun.file(filePath).text()) as unknown;
    }

    const instructions = args.instructions;

    if (!isString(instructions)) {
      fail({
        code: "ARGUMENT_ERROR",
        message: "`--instructions` requires a JSON string.",
      });
    }

    return JSON.parse(instructions) as unknown;
  } catch (error) {
    fail({
      code: "ARGUMENT_ERROR",
      message: "Failed to parse instruction JSON.",
      details: error instanceof Error ? error.message : error,
    });
  }
}

function validateBackend(value: unknown): value is WebViewBackend {
  if (value === "chrome" || value === "webkit") {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== "chrome") {
    return false;
  }

  if (value.path !== undefined && !isString(value.path)) {
    return false;
  }

  if (value.argv !== undefined && (!Array.isArray(value.argv) || value.argv.some(item => !isString(item)))) {
    return false;
  }

  return true;
}

function validateConfig(config: unknown): InstructionConfig | undefined {
  if (config === undefined) {
    return undefined;
  }

  if (!isRecord(config)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config` must be an object.",
    });
  }

  if (config.backend !== undefined && !validateBackend(config.backend)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config.backend` must be `chrome`, `webkit`, or a chrome backend object.",
      details: config.backend,
    });
  }

  if (config.width !== undefined && !isPositiveNumber(config.width)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config.width` must be a positive number.",
      details: config.width,
    });
  }

  if (config.height !== undefined && !isPositiveNumber(config.height)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config.height` must be a positive number.",
      details: config.height,
    });
  }

  if (config.url !== undefined && !isString(config.url)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config.url` must be a string.",
      details: config.url,
    });
  }

  if (config.console !== undefined && typeof config.console !== "boolean") {
    fail({
      code: "VALIDATION_ERROR",
      message: "`config.console` must be a boolean.",
      details: config.console,
    });
  }

  if (config.dataStore !== undefined) {
    const { dataStore } = config;

    if (dataStore !== "ephemeral") {
      if (!isRecord(dataStore) || !isString(dataStore.directory)) {
        fail({
          code: "VALIDATION_ERROR",
          message: "`config.dataStore` must be `ephemeral` or an object with a string `directory`.",
          details: dataStore,
        });
      }
    }
  }

  return config as InstructionConfig;
}

function expectString(value: unknown, message: string, details?: unknown): string {
  if (!isString(value)) {
    fail({ code: "VALIDATION_ERROR", message, details });
  }

  return value;
}

function expectNumber(value: unknown, message: string, details?: unknown): number {
  if (!isNumber(value)) {
    fail({ code: "VALIDATION_ERROR", message, details });
  }

  return value;
}

function expectPositiveNumber(value: unknown, message: string, details?: unknown): number {
  if (!isPositiveNumber(value)) {
    fail({ code: "VALIDATION_ERROR", message, details });
  }

  return value;
}

function validateScreenshotFormat(value: unknown): value is ScreenshotFormat {
  return value === "png" || value === "jpeg" || value === "webp";
}

function validateStep(step: unknown, index: number): InstructionStep {
  if (!isRecord(step)) {
    fail({
      code: "VALIDATION_ERROR",
      message: `Step ${index} must be an object.`,
      details: step,
    });
  }

  const action = expectString(step.action, `Step ${index} is missing a string \`action\`.`, step.action);

  switch (action) {
    case "navigate":
      return { action, url: expectString(step.url, `Step ${index} \`navigate.url\` must be a string.`, step.url) };
    case "click":
      if (isString(step.selector)) {
        return { action, selector: step.selector };
      }

      return {
        action,
        x: expectNumber(step.x, `Step ${index} \`click.x\` must be a number when no selector is provided.`, step.x),
        y: expectNumber(step.y, `Step ${index} \`click.y\` must be a number when no selector is provided.`, step.y),
      };
    case "type":
      return {
        action,
        selector: expectString(step.selector, `Step ${index} \`type.selector\` must be a string.`, step.selector),
        text: expectString(step.text, `Step ${index} \`type.text\` must be a string.`, step.text),
      };
    case "press": {
      const key = expectString(step.key, `Step ${index} \`press.key\` must be a string.`, step.key);
      const modifiers = step.modifiers;

      if (modifiers !== undefined && (!Array.isArray(modifiers) || modifiers.some(item => !isString(item)))) {
        fail({
          code: "VALIDATION_ERROR",
          message: `Step ${index} \`press.modifiers\` must be an array of strings.`,
          details: modifiers,
        });
      }

      return { action, key, modifiers: modifiers as Bun.WebView.PressOptions["modifiers"] | undefined };
    }
    case "evaluate":
      return { action, script: expectString(step.script, `Step ${index} \`evaluate.script\` must be a string.`, step.script) };
    case "wait":
      return { action, ms: expectNonNegativeNumber(step.ms, `Step ${index} \`wait.ms\` must be a non-negative number.`, step.ms) };
    case "screenshot": {
      if (step.path !== undefined && !isString(step.path)) {
        fail({
          code: "VALIDATION_ERROR",
          message: `Step ${index} \`screenshot.path\` must be a string when provided.`,
          details: step.path,
        });
      }

      if (step.format !== undefined && !validateScreenshotFormat(step.format)) {
        fail({
          code: "VALIDATION_ERROR",
          message: `Step ${index} \`screenshot.format\` must be \`png\`, \`jpeg\`, or \`webp\`.`,
          details: step.format,
        });
      }

      if (step.quality !== undefined && !isNonNegativeNumber(step.quality)) {
        fail({
          code: "VALIDATION_ERROR",
          message: `Step ${index} \`screenshot.quality\` must be a non-negative number.`,
          details: step.quality,
        });
      }

      return {
        action,
        path: step.path,
        format: step.format as ScreenshotFormat | undefined,
        quality: step.quality as number | undefined,
      };
    }
    case "scroll":
      return {
        action,
        dx: expectNumber(step.dx, `Step ${index} \`scroll.dx\` must be a number.`, step.dx),
        dy: expectNumber(step.dy, `Step ${index} \`scroll.dy\` must be a number.`, step.dy),
      };
    case "scrollTo":
      return {
        action,
        selector: expectString(step.selector, `Step ${index} \`scrollTo.selector\` must be a string.`, step.selector),
        block: step.block as Bun.WebView.ScrollToOptions["block"] | undefined,
      };
    case "resize":
      return {
        action,
        width: expectPositiveNumber(step.width, `Step ${index} \`resize.width\` must be a positive number.`, step.width),
        height: expectPositiveNumber(step.height, `Step ${index} \`resize.height\` must be a positive number.`, step.height),
      };
    case "back":
    case "forward":
    case "reload":
      return { action };
    default:
      fail({
        code: "VALIDATION_ERROR",
        message: `Step ${index} has an unsupported action: ${action}`,
      });
  }
}

function expectNonNegativeNumber(value: unknown, message: string, details?: unknown): number {
  if (!isNonNegativeNumber(value)) {
    fail({ code: "VALIDATION_ERROR", message, details });
  }

  return value;
}

function validateDocument(input: unknown): InstructionDocument {
  if (!isRecord(input)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "Instruction document must be an object.",
      details: input,
    });
  }

  if (!Array.isArray(input.steps)) {
    fail({
      code: "VALIDATION_ERROR",
      message: "`steps` must be an array.",
      details: input.steps,
    });
  }

  return {
    config: validateConfig(input.config),
    steps: input.steps.map((step, index) => validateStep(step, index)),
  };
}

function resolveViewOptions(config: InstructionConfig | undefined): Bun.WebView.ConstructorOptions {
  return {
    backend: config?.backend ?? DEFAULT_BACKEND,
    width: config?.width ?? DEFAULT_WIDTH,
    height: config?.height ?? DEFAULT_HEIGHT,
    url: config?.url,
    console: config?.console ? globalThis.console : undefined,
    dataStore: config?.dataStore,
  };
}

async function executeStep(view: Bun.WebView, step: InstructionStep): Promise<Omit<StepSuccessResult, "index" | "action" | "attempt">> {
  switch (step.action) {
    case "navigate":
      await view.navigate(step.url);
      return {};
    case "click":
      if ("selector" in step) {
        await view.click(step.selector);
      } else {
        await view.click(step.x, step.y);
      }
      return {};
    case "type":
      await view.click(step.selector);
      await view.type(step.text);
      return {};
    case "press":
      await view.press(step.key, step.modifiers ? { modifiers: step.modifiers } : undefined);
      return {};
    case "evaluate": {
      const result = await view.evaluate(step.script);
      return { result };
    }
    case "wait":
      await sleep(step.ms);
      return {};
    case "screenshot": {
      const image = await view.screenshot({
        encoding: "blob",
        format: step.format,
        quality: step.quality,
      });

      if (!step.path) {
        return {};
      }

      await Bun.write(step.path, image);
      return { screenshotPath: step.path };
    }
    case "scroll":
      await view.scroll(step.dx, step.dy);
      return {};
    case "scrollTo":
      await view.scrollTo(step.selector, step.block ? { block: step.block } : undefined);
      return {};
    case "resize":
      await view.resize(step.width, step.height);
      return {};
    case "back":
      await view.back();
      return {};
    case "forward":
      await view.forward();
      return {};
    case "reload":
      await view.reload();
      return {};
  }
}

async function runStepWithRetry(view: Bun.WebView, step: InstructionStep, index: number): Promise<StepSuccessResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt += 1) {
    try {
      const outcome = await executeStep(view, step);
      return {
        index,
        action: step.action,
        attempt,
        ...outcome,
      };
    } catch (error) {
      lastError = error;

      if (attempt === MAX_STEP_ATTEMPTS) {
        fail({
          code: "STEP_FAILED",
          message: `Step ${index} failed after ${MAX_STEP_ATTEMPTS} attempts.`,
          stepIndex: index,
          stepAction: step.action,
          attempts: MAX_STEP_ATTEMPTS,
          details: error instanceof Error ? { name: error.name, message: error.message } : error,
        });
      }
    }
  }

  throw lastError;
}

async function executeRun(args: CliOptions): Promise<void> {
  const rawInput = await loadInstructionSource(args);
  const document = validateDocument(rawInput);
  const view = new Bun.WebView(resolveViewOptions(document.config));

  try {
    const results: StepSuccessResult[] = [];

    for (const [index, step] of document.steps.entries()) {
      const result = await runStepWithRetry(view, step, index);
      results.push(result);
    }

    console.log(JSON.stringify({
      ok: true,
      steps: results,
      closingInMs: POST_RUN_DELAY_MS,
    }));

    await sleep(POST_RUN_DELAY_MS);
  } finally {
    view.close();
  }
}

const runCommand = command({
  name: "run",
  desc: "Execute a Bun.WebView instruction document.",
  help: printHelp,
  options: {
    file: string().desc("Read instructions from a JSON file."),
    instructions: string().desc("Read instructions from an inline JSON string."),
  },
  handler: async (options) => {
    await executeRun(options);
  },
});

const args = Bun.argv.slice(2);
const implicitRunArgs = args.length > 0 && !args[0]?.startsWith("-") ? args : ["run", ...args];

try {
  await run([runCommand], {
    name: CLI_NAME,
    description: CLI_DESCRIPTION,
    version: CLI_VERSION,
    omitKeysOfUndefinedOptions: true,
    argSource: [Bun.argv[0] ?? "bun", Bun.argv[1] ?? "bunwright.ts", ...implicitRunArgs],
    theme: (event) => {
      if (event.type === "error") {
        fail({
          code: "ARGUMENT_ERROR",
          message: event.violation === "unknown_error"
            ? normalizeArgumentError(event.error)
            : formatCliError(event),
        });
      }

      return false;
    },
  });
} catch (error) {
  fail({
    code: "ARGUMENT_ERROR",
    message: normalizeArgumentError(error),
  });
}
