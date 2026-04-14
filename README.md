<h1 align="center">
  <strong>Bunwright</strong>
</h1>

<p align="center">
  <strong>The lightweight browser automation library for Bun</strong>
</p>

<p align="center">
  JSON-driven browser automation built on <code>Bun.WebView</code>.
  <br />
  A smaller, Bun-native alternative for automation flows where Playwright would be heavier than necessary.
</p>

---

`bunwright` is a lightweight browser automation tool for Bun focused on simple, scriptable workflows.
It lets you describe browser actions as JSON and execute them through `Bun.WebView`, making it useful for local automation, repeatable UI flows, and small browser-driven utilities.

If you want a Playwright alternative for Bun that is smaller in scope, faster to wire into Bun projects, and centered on lightweight automation instead of a full end-to-end testing stack, `bunwright` is built for that space.

## Use Cases

- Automate repetitive internal web workflows such as logins, form filling, and admin panel tasks
- Capture screenshots of pages or post-login states from scripted browser sessions
- Run lightweight browser-driven data collection or verification flows
- Prototype browser automations in Bun without adopting a larger testing framework
- Execute JSON-defined automation steps from other Bun tools, scripts, or local CLIs

## Install

### npm

Install globally with npm:

```bash
npm install -g bunwright
```

Then run:

```bash
bunwright --file instructions.json
```

### Development

Install dependencies in this repository:

```bash
bun install
```

Run the CLI directly during development:

```bash
bun run bunwright.ts --help
```

## Quick Start

Run a JSON instruction file:

```bash
bunx bunwright --file instructions.json
```

Or pass instructions inline:

```bash
bunx bunwright --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

Schema documentation lives in `docs/instructions-schema.md`.
Sample input lives in `instructions.json`.

## Example

Example instruction document:

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
    { "action": "click", "selector": "button[type=submit]" },
    { "action": "wait", "ms": 1500 },
    { "action": "screenshot", "path": "./generated/login.png", "format": "png" }
  ]
}
```

Run it with:

```bash
bunx bunwright --file instructions.json
```

On success, `bunwright` prints structured JSON to stdout describing the executed steps.

## Link The CLI Into Another Bun Project

From this repository:

```bash
bun link
```

From the other project:

```bash
bun link bunwright
```

Then run the linked executable:

```bash
bunwright --file instructions.json
```

Or with Bun's package runner:

```bash
bunx bunwright --file instructions.json
```

## CLI Usage

```bash
bunx bunwright --file instructions.json
bunx bunwright --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

Pass exactly one of `--file` or `--instructions`.

This project was created using `bun init` in bun v1.3.12. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
