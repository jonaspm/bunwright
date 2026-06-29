# Bunwright Website

Landing page and documentation site for [Bunwright](https://github.com/jonaspm/bunwright), built with [Astro Starlight](https://starlight.astro.build).

## Structure

```
src/
├── assets/
│   └── logo.svg              # Custom Bunwright logo
├── content/
│   └── docs/
│       ├── index.mdx          # Landing page (splash template)
│       ├── guides/            # 6 guide pages
│       ├── reference/         # 7 reference pages
│       └── examples/          # 6 example pages
├── styles/
│   └── global.css             # Bun amber theme overrides
└── scripts/
    └── sync-api.ts            # API reference sync script
```

## Commands

```bash
bun install              # install dependencies
bun run dev              # start dev server at localhost:4321
bun run build            # build production site to ./dist/
bun run preview          # preview the build locally
bun run sync-api         # sync API reference from packages/app
```

## API Reference Sync

The `sync-api` script reads the auto-generated API reference from `packages/app/docs/api-reference.md` and:

1. Copies the full content to `reference/full-api.md`
2. Injects method/property tables into per-class reference pages between `<!-- AUTO:START -->` / `<!-- AUTO:END -->` markers

Run it manually after regenerating the app's API docs:

```bash
# In packages/app:
bun run docs

# In packages/website:
bun run sync-api
```

## Deployment

Static output — deploy `dist/` to any static host (Cloudflare Pages, Vercel, Netlify, etc.).
