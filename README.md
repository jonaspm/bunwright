# factuclaw

To install dependencies:

```bash
bun install
```

## Link The CLI Into Another Bun Project

From this repository:

```bash
bun link
```

From the other project:

```bash
bun link factuclaw-cli
```

Then run the linked executable:

```bash
factuclaw-cli --file instructions.json
```

Or with Bun's package runner:

```bash
bunx factuclaw-cli --file instructions.json
```

## CLI Usage

```bash
bunx factuclaw-cli.ts --file instructions.json
bunx factuclaw-cli.ts --instructions '{"steps":[{"action":"navigate","url":"https://example.com"}]}'
```

Schema documentation lives in `docs/instructions-schema.md`.
Sample input lives in `instructions.json`.

To configure Prisma with the local `content.db` database:

```bash
bun run prisma:generate
bun run prisma:push
```

To run:

```bash
bun run factuclaw-cli.ts --help
```

This project was created using `bun init` in bun v1.3.12. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
