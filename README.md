# rigit

Single-command **tabbed** TUI for git staging, commit, push, branches, and diff.

```bash
rigit
```

Opens on **Commit/Push** (staging) by default.

## UI

```
 rigit  · main
 [ Commit/Push ]   Branching   Diff   Log

 [x] All files
 [ ] src/cli.ts     modified
 [x] README.md      modified
```

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Switch tabs |
| `↑` `↓` | Move |
| `Space` | Toggle file (or **All files** = every path) |
| `a` | Select all / none |
| `Enter` | Commit flow (message → push) |
| `r` | Refresh |
| `q` / `Esc` | Quit |

### Tabs

- **Commit/Push** — stage selected files, auto/custom message, optional push  
- **Branching** — switch (`enter`) or create (`n`)  
- **Diff** — browse changes (`s` scope), or **compare two things** side-by-side (`c`)  
- **Log** — recent commits  

### Diff → Compare two things

Press **`c`** on the Diff tab:

1. Pick **two** items with `space` (or `1` left / `2` right)  
   - **`m`** toggles **refs/commits** vs **files**  
   - Refs include Working tree, Staged, HEAD, branches, recent commits  
2. Side-by-side view: **red (−) left** / **green (+) right**  
3. **`p`** opens full diff in pager · **`b`** back to picks/browse  


## Install

```bash
npm install
npm run build
npm link          # optional
```

```bash
npm run dev       # development
npm start         # after build
```

## Auto commit messages

- **Default:** heuristic from staged paths / diff  
- **Optional AI:** `export XAI_API_KEY=...` (xAI `grok-4.5`)

## Requirements

- Node.js 18+
- `git` on PATH
- Interactive terminal (TTY)
