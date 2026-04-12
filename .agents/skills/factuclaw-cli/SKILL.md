# Skill: factuclaw-cli

## When to Use This Skill

Use this skill when you need a reusable, JSON-driven browser automation CLI based on `Bun.WebView`, especially when you want to:

- run scripted browser steps from CI, scripts, or local tooling
- keep automation steps in a JSON file instead of hardcoding them in TypeScript
- reuse the `factuclaw-cli` package in another Bun project via `bun link`
- document or generate instruction files for a `Bun.WebView` runner

## What This Project Provides

This repository exposes a CLI named `factuclaw-cli`.

It accepts one JSON instruction document and executes its steps sequentially through `Bun.WebView`.

### Supported input modes

```bash
factuclaw-cli --file instructions.json
factuclaw-cli --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

### Runtime behavior

- steps run sequentially
- each step is awaited implicitly
- explicit pauses use a `wait` step with milliseconds
- failed steps retry up to 3 times
- if the third attempt fails, the CLI exits non-zero and prints structured JSON to stderr
- after success, the browser stays open for 10 seconds and then closes

## Link Into Another Project

From this repository:

```bash
bun link
```

From the consuming repository:

```bash
bun link factuclaw-cli
```

Then run:

```bash
factuclaw-cli --file instructions.json
```

Or through Bun:

```bash
bunx factuclaw-cli --file instructions.json
```

## Instruction Document Shape

```json
{
  "config": {
    "backend": "chrome",
    "width": 1280,
    "height": 800,
    "console": true,
    "dataStore": { "directory": "./generated/profile" }
  },
  "steps": [
    { "action": "navigate", "url": "https://example.com" },
    { "action": "wait", "ms": 1000 },
    { "action": "screenshot", "path": "./generated/example.png", "format": "png" }
  ]
}
```

## Config Fields

| Field | Type | Notes |
| --- | --- | --- |
| `backend` | `"chrome" | "webkit" | { "type": "chrome", "path"?: string, "argv"?: string[] }` | Defaults to `chrome` in this CLI |
| `width` | `number` | Positive viewport width |
| `height` | `number` | Positive viewport height |
| `url` | `string` | Initial URL |
| `console` | `boolean` | When true, forwards page console output |
| `dataStore` | `"ephemeral" | { "directory": string }` | Storage persistence |

## Supported Actions

| Action | Required fields |
| --- | --- |
| `navigate` | `url` |
| `click` | `selector` or `x` and `y` |
| `type` | `selector`, `text` |
| `press` | `key`, optional `modifiers` |
| `evaluate` | `script` |
| `wait` | `ms` |
| `screenshot` | optional `path`, optional `format`, optional `quality` |
| `scroll` | `dx`, `dy` |
| `scrollTo` | `selector`, optional `block` |
| `resize` | `width`, `height` |
| `back` | none |
| `forward` | none |
| `reload` | none |

## Authoring Guidance

- prefer `backend: "chrome"` for cross-platform use
- keep `evaluate` scripts as expressions; wrap multi-statement logic in an IIFE
- use `type` when you want to focus a selector and insert text exactly as given
- use `wait` only for explicit timing gaps; normal step sequencing is already awaited
- write screenshots to a file path when you need a durable artifact

## Output Contract

Successful runs print JSON to stdout:

```json
{
  "ok": true,
  "steps": [
    { "index": 0, "action": "navigate", "attempt": 1 },
    { "index": 1, "action": "screenshot", "attempt": 1, "screenshotPath": "./generated/example.png" }
  ],
  "closingInMs": 10000
}
```

Failed runs print JSON to stderr:

```json
{
  "ok": false,
  "error": {
    "code": "STEP_FAILED",
    "message": "Step 1 failed after 3 attempts.",
    "stepIndex": 1,
    "stepAction": "click",
    "attempts": 3
  }
}
```

## Repository References

- CLI entrypoint: `factuclaw-cli.ts`
- schema docs: `docs/instructions-schema.md`
- sample input: `instructions.json`

Use those files as the source of truth when adapting the CLI in another project.
