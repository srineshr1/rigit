# rigit

Single-command TUI for **staging**, **committing**, and **pushing** git changes.

```bash
rigit
```

## Flow

1. **Choose files** — multi-select (or “All files”)
2. **Commit message** — auto-generated (edit or replace)
3. **Push** — confirm to push to remote

Matches the flow in `Design.md`.

## Install

```bash
npm install
npm run build
npm link          # optional: install `rigit` on your PATH
```

Or run without linking:

```bash
npm run dev       # tsx src/cli.ts
# or
npm start         # after build
```

## Auto commit messages

- **Default:** heuristic from staged paths / `git diff --cached`
- **Optional AI:** set `XAI_API_KEY` to generate messages via xAI (`grok-4.5`)

```bash
export XAI_API_KEY=...
rigit
```

## Requirements

- Node.js 18+
- `git` on PATH
