# rigit

Single-command **tabbed** TUI for git staging, commit, push, branches, and diff.

```bash
rigit
```

Opens on **Commit/Push** (staging) by default.

## UI

```
 rigit  · main
 [ Commit/Push ]   Branching   Diff   Log   Help

 [x] All files
 [ ] src/cli.ts     modified
 [x] README.md      untracked
```

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Switch tabs |
| `↑` `↓` | Move |
| `Space` | Toggle file (**All files** selects every path) |
| `a` | Select all / none |
| `Enter` | Commit flow (message → push) |
| `Esc` | Cancel pre-commit (**unstages** what rigit staged) |
| `q` | Quit |

### Tabs

- **Commit/Push** — stage · message · push  
- **Branching** — switch / create  
- **Diff** — browse or compare two things side-by-side  
- **Log** — recent commits  
- **Help** — file list vs commit vs push explained  

### Diff → Compare two things

Press **`c`** on the Diff tab:

1. Pick **two** items with `space` (or `1` left / `2` right)  
   - **`m`** toggles **refs/commits** vs **files**  
   - Refs include Working tree, Staged, HEAD, branches, recent commits  
2. Side-by-side view: **red (−) left** / **green (+) right**  
3. **`p`** opens full diff in pager · **`b`** back to picks/browse  


## Install

```bash
# global CLI (command is still `rigit`)
npm install -g @srinesh/rigit
rigit

# or one-off
npx @srinesh/rigit
```

### From source

```bash
npm install
npm run build
npm link          # optional local global link
npm run dev       # development
```

## Auto commit messages

- **Default:** heuristic from staged paths / diff  
- **Optional AI:** `export XAI_API_KEY=...` (xAI `grok-4.5`)

## Setup & edge cases

`rigit` guides you through common situations instead of only failing:

| Situation | What happens |
|-----------|----------------|
| **No git repo** | Asks to run `git init` in the current folder |
| **No user.name / email** | Prompts for name + email (`git config --local`) |
| **No remote** (on push) | Offers to add a remote URL, then push |
| **Empty repo** | Banner + friendly Log/Diff (no crash on missing HEAD) |
| **Merge / rebase / cherry-pick / revert** | Warning banner |
| **Detached HEAD** | Warning banner |
| **Push rejected** | Shows git error + hints (no force-push) |
| **git missing / no TTY** | Clear error and exit |

## Requirements

- Node.js 18+
- `git` on PATH
- Interactive terminal (TTY)
