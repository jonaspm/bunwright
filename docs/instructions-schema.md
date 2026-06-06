# Instructions Schema

`bunwright.ts` reads a JSON instruction document and executes each step with `Bun.WebView`.

## Usage

```bash
bunx bunwright --file instructions.json
bunx bunwright --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

Pass exactly one of `--file` or `--instructions`.

## Document Shape

```json
{
  "config": {
    "backend": "chrome",
    "width": 1280,
    "height": 800,
    "url": "https://example.com",
    "console": true,
    "dataStore": { "directory": "./generated/profile" }
  },
  "steps": [
    {
      "action": "navigate",
      "url": "https://example.com/login"
    }
  ]
}
```

## Config

`config` is optional.

| Field       | Type         | Required                 | Notes                                                       |
| ----------- | ------------ | ------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `backend`   | `"chrome"    | "webkit"                 | { "type": "chrome", "path"?: string, "argv"?: string[] }`   | No                                                                                           | Defaults to `"chrome"`. Use Chrome on Windows and Linux. |
| `width`     | `number`     | No                       | Positive number. Defaults to `1280`.                        |
| `height`    | `number`     | No                       | Positive number. Defaults to `800`.                         |
| `url`       | `string`     | No                       | Initial URL loaded when the WebView opens.                  |
| `console`   | `boolean`    | No                       | When `true`, forwards page console logs to the CLI process. |
| `dataStore` | `"ephemeral" | { "directory": string }` | No                                                          | Defaults to ephemeral storage. Use `{ "directory": "./path" }` for persistent browser state. |

## Steps

`steps` is required and must be an array.

Each step runs sequentially. The CLI awaits each step automatically. If you need an explicit pause, use the `wait` step.

If a step fails, the CLI retries it up to 3 times. If the third attempt still fails, the CLI stops and prints structured JSON to stderr.

After all steps succeed, the browser remains open for 10 seconds and then closes.

### `navigate`

```json
{ "action": "navigate", "url": "https://example.com" }
```

### `click`

Selector-based click:

```json
{ "action": "click", "selector": "button[type=submit]" }
```

Coordinate-based click:

```json
{ "action": "click", "x": 320, "y": 240 }
```

### `type`

```json
{ "action": "type", "selector": "input[name=email]", "text": "user@example.com" }
```

The CLI focuses the selector first and then calls `view.type()`.

### `press`

```json
{ "action": "press", "key": "Enter" }
```

With modifiers:

```json
{ "action": "press", "key": "a", "modifiers": ["Control"] }
```

### `evaluate`

```json
{ "action": "evaluate", "script": "document.title" }
```

`script` must be a JavaScript expression. For multiple statements, wrap them in an IIFE.

```json
{
  "action": "evaluate",
  "script": "(() => { const title = document.title; return title.toUpperCase(); })()"
}
```

### `wait`

```json
{ "action": "wait", "ms": 1500 }
```

Milliseconds must be zero or greater.

### `screenshot`

Save to a file:

```json
{ "action": "screenshot", "path": "./generated/login.png", "format": "png" }
```

Without a path:

```json
{ "action": "screenshot" }
```

Supported formats are `png`, `jpeg`, and `webp`.

If `path` is provided, the success output includes `screenshotPath`.

### `scroll`

```json
{ "action": "scroll", "dx": 0, "dy": 600 }
```

### `scrollTo`

```json
{ "action": "scrollTo", "selector": "#footer", "block": "center" }
```

### `resize`

```json
{ "action": "resize", "width": 1440, "height": 900 }
```

### `back`

```json
{ "action": "back" }
```

### `forward`

```json
{ "action": "forward" }
```

### `reload`

```json
{ "action": "reload" }
```

## Success Output

Successful runs print JSON to stdout.

```json
{
  "ok": true,
  "steps": [
    {
      "index": 0,
      "action": "navigate",
      "attempt": 1
    },
    {
      "index": 1,
      "action": "screenshot",
      "attempt": 1,
      "screenshotPath": "./generated/homepage.png"
    }
  ],
  "closingInMs": 10000
}
```

`evaluate` steps include their returned value in `result` when it is JSON-serializable.

## Failure Output

Failures print JSON to stderr and exit with a non-zero code.

```json
{
  "ok": false,
  "error": {
    "code": "STEP_FAILED",
    "message": "Step 2 failed after 3 attempts.",
    "stepIndex": 2,
    "stepAction": "click",
    "attempts": 3,
    "details": {
      "name": "Error",
      "message": "Element was not actionable"
    }
  }
}
```

Possible error codes:

| Code               | Meaning                                     |
| ------------------ | ------------------------------------------- |
| `ARGUMENT_ERROR`   | Invalid CLI arguments or invalid JSON input |
| `VALIDATION_ERROR` | JSON shape does not match the schema        |
| `STEP_FAILED`      | A step failed 3 times                       |

## Example File

```json
{
  "config": {
    "backend": "chrome",
    "width": 1440,
    "height": 900,
    "console": true
  },
  "steps": [
    { "action": "navigate", "url": "https://example.com/login" },
    { "action": "type", "selector": "input[name=email]", "text": "user@example.com" },
    { "action": "press", "key": "Tab" },
    { "action": "type", "selector": "input[name=password]", "text": "secret" },
    { "action": "click", "selector": "button[type=submit]" },
    { "action": "wait", "ms": 2000 },
    { "action": "screenshot", "path": "./generated/after-login.png", "format": "png" }
  ]
}
```
