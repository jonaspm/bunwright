type WebViewBackend = Bun.WebView.ConstructorOptions["backend"];

type ScreenshotFormat = "png" | "jpeg" | "webp";

interface InstructionConfig {
  backend?: WebViewBackend;
  width?: number;
  height?: number;
  url?: string;
  console?: boolean;
  dataStore?: "ephemeral" | { directory: string };
}

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

interface InstructionDocument {
  config?: InstructionConfig;
  steps: InstructionStep[];
}

interface StepSuccessResult {
  index: number;
  action: InstructionStep["action"];
  attempt: number;
  result?: unknown;
  screenshotPath?: string;
}

interface FailureOutput {
  ok: false;
  error: {
    code: "VALIDATION_ERROR" | "ARGUMENT_ERROR" | "STEP_FAILED";
    message: string;
    stepIndex?: number;
    stepAction?: InstructionStep["action"];
    attempts?: number;
    details?: unknown;
  };
}

export type { InstructionDocument, InstructionConfig, InstructionStep, StepSuccessResult, FailureOutput, ScreenshotFormat };
