# Failure Examples

These runs were executed from the repository root on Windows PowerShell with:

```bash
bun run bunwright.ts ...
```

Each example below is intentionally invalid and exited with status code `1`.

## 1. Conflicting CLI arguments

Command:

```bash
bun run bunwright.ts --instructions '{"steps":[{"action":"wait","ms":0}]}' --file instructions.json
```

Instructions used:

```json
{"steps":[{"action":"wait","ms":0}]}
```

Observed result:

```json
{"ok":false,"error":{"code":"ARGUMENT_ERROR","message":"Provide exactly one of --file or --instructions."}}
```

## 2. Malformed inline JSON

Command:

```bash
bun run bunwright.ts --instructions '{"steps":['
```

Instructions used:

```json
{"steps":[
```

Observed result:

```json
{"ok":false,"error":{"code":"ARGUMENT_ERROR","message":"Failed to parse instruction JSON.","details":"JSON Parse error: Unexpected EOF"}}
```

## 3. Invalid config value

Command:

```bash
bun run bunwright.ts --instructions '{"config":{"width":0},"steps":[{"action":"wait","ms":0}]}'
```

Instructions used:

```json
{"config":{"width":0},"steps":[{"action":"wait","ms":0}]}
```

Observed result:

```json
{"ok":false,"error":{"code":"VALIDATION_ERROR","message":"`config.width` must be a positive number.","details":0}}
```

## 4. Unsupported step action

Command:

```bash
bun run bunwright.ts --instructions '{"steps":[{"action":"explode"}]}'
```

Instructions used:

```json
{"steps":[{"action":"explode"}]}
```

Observed result:

```json
{"ok":false,"error":{"code":"VALIDATION_ERROR","message":"Step 0 has an unsupported action: explode"}}
```

## 5. Valid instructions, failing runtime environment

Command:

```bash
bun run bunwright.ts --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

Instructions used:

```json
{"steps":[{"action":"navigate","url":"https://example.com"}]}
```

Observed result on this machine:

```json
{"ok":false,"error":{"code":"ARGUMENT_ERROR","message":"Failed to spawn Chrome (set BUN_CHROME_PATH, backend.path, or install Chrome/Chromium)"}}
```

This payload is valid, but `Bun.WebView` could not start because Chrome or Chromium was not available in the current environment.

## Note On `STEP_FAILED`

`bunwright` can also fail with `STEP_FAILED` after retrying a step 3 times.
That path is reached in `runStepWithRetry()` only after the browser starts successfully and a step throws during execution.

Example payload that should produce `STEP_FAILED` in an environment with a working browser backend:

```json
{
  "steps": [
    { "action": "navigate", "url": "https://example.com" },
    { "action": "click", "selector": "#__definitely_missing__" }
  ]
}
```

Expected failure shape:

```json
{
  "ok": false,
  "error": {
    "code": "STEP_FAILED",
    "message": "Step 1 failed after 3 attempts.",
    "stepIndex": 1,
    "stepAction": "click",
    "attempts": 3,
    "details": {
      "name": "Error",
      "message": "..."
    }
  }
}
```
