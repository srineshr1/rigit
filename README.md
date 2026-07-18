# rigit

### Git, without the ceremony.

**One command.** Stage → commit → push. Branch, diff, and edit `.gitignore` without leaving the terminal.

[![npm](https://img.shields.io/npm/v/@srinesh/rigit?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@srinesh/rigit)
[![node](https://img.shields.io/node/v/@srinesh/rigit?style=flat-square)](https://www.npmjs.com/package/@srinesh/rigit)
[![license](https://img.shields.io/npm/l/@srinesh/rigit?style=flat-square)](./package.json)

```bash
npx @srinesh/rigit
# or
npm i -g @srinesh/rigit && rigit

# first-time: API keys + GitHub
rigit setup
```

---

## Why rigit?

| Instead of… | You get… |
|-------------|----------|
| `git status` → `add` → `commit` → `push` | One keyboard-driven flow |
| Guessing what’s staged vs pushed | Clear file list + **Sync** line + **PUSHED** / **COMMITTED** banners |
| Fighting a bare repo | Guided **init**, identity, and remote setup |
| Jumping to an editor for `.gitignore` | Browse the tree, pick files, open folders with `o` |

Built for people who live in the terminal — not another full IDE.

---

## Preview

```
 ┌─ rigit ─┐ · main                          tab · q

  [ Commit/Push ]  Branching  Diff  Gitignore  Log  Help

  Sync · ✓ up to date with origin/main
  [ PUSHED ]  Code is on the remote — a1b2c3d → origin/main

  ❯ [x] All files                         4
    [x] src/cli.ts                        modified
    [ ] README.md                         untracked
    [x] package.json                      staged

  ↑↓ move · space toggle · a all · enter commit · tab · q
```

---

## Features

### Commit / Push
Pick files, get a suggested message (or type your own), confirm push.  
**All files** selects everything. Esc after staging **unstages** cleanly.

### Branching
Switch branches or create a new one without raw `git switch` flags.

### Diff
Pick **two** things (branches, commits, working tree, or files) — then see a **side-by-side** (− red / + green) compare. Nothing shows until you pick two.

### Gitignore
Browse the repo tree:
- **`o`** open folder · **`c`** close folder  
- **space** select · **enter** add to `.gitignore`  
Also: type a custom pattern, use presets, delete lines.

### Log & Help
Recent commits at a glance, plus a short mental model of *files → commit → push*.

### Smart setup
| Situation | rigit does |
|-----------|------------|
| No git repo | Offers `git init` |
| No name / email | Prompts and sets local config |
| No remote on push | Asks for URL, then pushes |
| Merge / rebase / detached | Warning banner |
| Push rejected | Shows git’s error + hints (**never** force-pushes) |

---

## Install

```bash
# try once
npx @srinesh/rigit

# install globally
npm install -g @srinesh/rigit
rigit
```

### From source

```bash
git clone <your-repo-url>
cd qit
npm install
npm run build
npm link          # optional
npm run dev       # run from source
```

---

## Keyboard cheatsheet

| Key | Where | Action |
|-----|--------|--------|
| `Tab` / `Shift+Tab` | Anywhere | Switch tabs |
| `↑` `↓` | Lists | Move |
| `Space` | Commit / Diff / Gitignore | Select |
| `a` | Commit | Select all / none |
| `a` | Gitignore | Open file picker |
| `Enter` | Commit | Stage → message → push |
| `o` / `c` | Gitignore browse | Open / close folder |
| `Esc` | Pre-commit | Cancel & unstage |
| `q` | Main UI | Quit |

---

## Setup (`rigit setup`)

Interactive config — no need to hand-edit env vars:

```bash
rigit setup
```

| Section | What you can do |
|---------|------------------|
| **AI providers** | Save **xAI**, **Groq**, or **Gemini** API keys; pick default provider / model |
| **GitHub** | Run **`gh auth login`**, or paste a **personal access token** |
| **Status** | View masked keys + whether `gh` is logged in |

Settings are stored in:

```
~/.config/rigit/config.json    # chmod 600
```

Environment variables still work and **override** the config file when set.

### Commit messages (AI)

By default: short **heuristic** from staged paths (offline).

| Provider | Env / setup key | Default model |
|----------|-----------------|---------------|
| **xAI** | `XAI_API_KEY` | `grok-4.5` |
| **Groq** | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| **Gemini** | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `gemini-2.0-flash` |

```bash
rigit setup          # recommended
# or export keys yourself:
export GROQ_API_KEY=...
export RIGIT_AI_PROVIDER=groq
export RIGIT_AI_MODEL=llama-3.1-8b-instant   # optional
```

If several keys exist, order is **xAI → Groq → Gemini** (or force with `RIGIT_AI_PROVIDER`).  
API failure → falls back to heuristic.

### GitHub

- **`gh auth login`** via setup (uses the official GitHub CLI)  
- Or save **`GITHUB_TOKEN` / `GH_TOKEN`** in setup for tools that read those env vars  

---

## Requirements

- **Node.js 18+**
- **`git`** on your `PATH`
- An **interactive terminal** (not a pure pipe / headless CI)

---

## Mental model (30 seconds)

```
  disk changes  ──commit──►  local history  ──push──►  remote
       ▲                          ▲
   file list                   Sync ↑ N
  (this tab)              (not pushed yet)
```

The file list is **only uncommitted work**.  
After commit, files leave the list — check **Sync** and the top banner to see if you’re on the remote.

---

## License

MIT · Built with [Ink](https://github.com/vadimdemedes/ink) + TypeScript

```bash
npx @srinesh/rigit
```
