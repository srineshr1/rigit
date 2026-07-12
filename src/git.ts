import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export type ChangedFile = {
  path: string;
  /** Short status code from porcelain, e.g. " M", "??", "M " */
  status: string;
  label: string;
};

function runGit(
  args: string[],
  opts: { allowFailure?: boolean; input?: string } = {},
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    input: opts.input,
    maxBuffer: 20 * 1024 * 1024,
  });

  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (!opts.allowFailure && status !== 0) {
    const msg = (stderr || stdout || `git ${args.join(" ")} failed`).trim();
    throw new Error(msg);
  }

  return { stdout, stderr, status };
}

export function isGitRepo(): boolean {
  const { status } = runGit(["rev-parse", "--is-inside-work-tree"], {
    allowFailure: true,
  });
  return status === 0;
}

export function getChangedFiles(): ChangedFile[] {
  const { stdout } = runGit(["status", "--porcelain=v1", "-uall"]);
  if (!stdout.trim()) return [];

  const files: ChangedFile[] = [];
  const seen = new Set<string>();

  for (const line of stdout.split("\n")) {
    if (!line || line.length < 4) continue;

    const status = line.slice(0, 2);
    let pathPart = line.slice(3);

    // Rename/copy: "R  old -> new"
    if (pathPart.includes(" -> ")) {
      pathPart = pathPart.split(" -> ").pop() ?? pathPart;
    }

    // Quoted paths from git
    const path = unquoteGitPath(pathPart);
    if (!path || seen.has(path)) continue;
    seen.add(path);

    files.push({
      path,
      status,
      label: `${formatStatus(status)} ${path}`,
    });
  }

  return files;
}

function unquoteGitPath(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      s = JSON.parse(s) as string;
    } catch {
      s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return s;
}

function formatStatus(status: string): string {
  return describeChange(status).label;
}

/**
 * Human label for porcelain XY codes.
 * Index (staged) is the first char, worktree is the second.
 */
export function describeChange(status: string): {
  label: string;
  /** rough category for coloring */
  kind: "staged" | "unstaged" | "both" | "untracked" | "unmerged" | "other";
} {
  const xy = (status + "  ").slice(0, 2);
  const x = xy[0] ?? " ";
  const y = xy[1] ?? " ";

  if (x === "?" && y === "?") {
    return { label: "untracked", kind: "untracked" };
  }
  if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
    return { label: "unmerged", kind: "unmerged" };
  }

  const staged = x !== " " && x !== "?";
  const unstaged = y !== " " && y !== "?";

  if (staged && unstaged) {
    return { label: "staged+unstaged", kind: "both" };
  }
  if (staged) {
    const verb =
      x === "A" ? "staged new" :
      x === "D" ? "staged delete" :
      x === "R" ? "staged rename" :
      x === "M" ? "staged" :
      `staged (${x})`;
    return { label: verb, kind: "staged" };
  }
  if (unstaged) {
    const verb =
      y === "D" ? "deleted" :
      y === "M" ? "modified" :
      `changed (${y})`;
    return { label: verb, kind: "unstaged" };
  }
  return { label: xy.trim() || "changed", kind: "other" };
}

export function statusLabel(status: string): string {
  return describeChange(status).label;
}

export function stageFiles(paths: string[] | "all"): void {
  if (paths === "all") {
    runGit(["add", "-A"]);
    return;
  }
  if (paths.length === 0) return;
  runGit(["add", "--", ...paths]);
}

export function getStagedDiffSummary(): string {
  const nameStatus = runGit(["diff", "--cached", "--name-status"], {
    allowFailure: true,
  }).stdout.trim();
  const stat = runGit(["diff", "--cached", "--stat"], {
    allowFailure: true,
  }).stdout.trim();
  const parts = [nameStatus, stat].filter(Boolean);
  return parts.join("\n\n");
}

export function getStagedDiffForAi(maxChars = 12_000): string {
  const nameStatus = runGit(["diff", "--cached", "--name-status"], {
    allowFailure: true,
  }).stdout.trim();
  const patch = runGit(["diff", "--cached", "--no-color"], {
    allowFailure: true,
  }).stdout.trim();

  let body = [nameStatus, patch].filter(Boolean).join("\n\n");
  if (body.length > maxChars) {
    body = body.slice(0, maxChars) + "\n…(truncated)";
  }
  return body;
}

export function commit(message: string): string {
  runGit(["commit", "-m", message]);
  const { stdout } = runGit(["rev-parse", "--short", "HEAD"]);
  return stdout.trim();
}

export function currentBranch(): string {
  const { stdout, status } = runGit(["branch", "--show-current"], {
    allowFailure: true,
  });
  if (status === 0 && stdout.trim()) return stdout.trim();
  return "HEAD";
}

export function hasRemote(name = "origin"): boolean {
  const { stdout } = runGit(["remote"], { allowFailure: true });
  return stdout
    .split("\n")
    .map((r) => r.trim())
    .includes(name);
}

export function hasUpstream(): boolean {
  const { status } = runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], {
    allowFailure: true,
  });
  return status === 0;
}

export type PushResult =
  | {
      ok: true;
      detail: string;
      hash: string;
      branch: string;
      remote?: string;
    }
  | { ok: false; error: string; code?: "no_remote" | "rejected" | "other" };

function pushSuccessDetail(remoteHint?: string): PushResult {
  const hash = runGit(["rev-parse", "--short", "HEAD"], {
    allowFailure: true,
  }).stdout.trim();
  const branch = currentBranch();
  let remote = remoteHint;
  if (!remote) {
    const up = runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], {
      allowFailure: true,
    }).stdout.trim();
    if (up) remote = up;
  }
  return {
    ok: true,
    hash,
    branch,
    remote,
    detail: remote
      ? `Pushed ${hash} → ${remote}`
      : `Pushed ${hash} on ${branch}`,
  };
}

export function push(): PushResult {
  if (hasUpstream()) {
    const r = runGit(["push"], { allowFailure: true });
    if (r.status === 0) {
      return pushSuccessDetail();
    }
    return {
      ok: false,
      error: formatPushError(r.stderr || r.stdout),
      code: "rejected",
    };
  }

  if (hasRemote("origin")) {
    const r = runGit(["push", "-u", "origin", "HEAD"], { allowFailure: true });
    if (r.status === 0) {
      return pushSuccessDetail(`origin/${currentBranch()}`);
    }
    return {
      ok: false,
      error: formatPushError(r.stderr || r.stdout),
      code: "rejected",
    };
  }

  // Any other remotes?
  const remotes = listRemotes();
  if (remotes.length > 0) {
    const name = remotes[0]!.name;
    const r = runGit(["push", "-u", name, "HEAD"], { allowFailure: true });
    if (r.status === 0) {
      return pushSuccessDetail(`${name}/${currentBranch()}`);
    }
    return {
      ok: false,
      error: formatPushError(r.stderr || r.stdout),
      code: "rejected",
    };
  }

  return {
    ok: false,
    error: "No remote configured. Add one to push.",
    code: "no_remote",
  };
}

/** How local branch compares to its upstream (committed vs pushed). */
export type SyncStatus =
  | { kind: "empty" }
  | { kind: "no_remote" }
  | { kind: "no_upstream"; branch: string }
  | { kind: "synced"; upstream: string; hash: string }
  | { kind: "ahead"; upstream: string; ahead: number; hash: string }
  | { kind: "behind"; upstream: string; behind: number; hash: string }
  | {
      kind: "diverged";
      upstream: string;
      ahead: number;
      behind: number;
      hash: string;
    };

export function getSyncStatus(): SyncStatus {
  if (!hasCommits()) return { kind: "empty" };

  const hash = runGit(["rev-parse", "--short", "HEAD"], {
    allowFailure: true,
  }).stdout.trim();

  if (!hasUpstream()) {
    if (listRemotes().length === 0) return { kind: "no_remote" };
    return { kind: "no_upstream", branch: currentBranch() };
  }

  const upstream = runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], {
    allowFailure: true,
  }).stdout.trim();

  const counts = runGit(
    ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    { allowFailure: true },
  ).stdout.trim();
  // format: "<behind>\t<ahead>"
  const parts = counts.split(/\s+/).map((n) => Number(n) || 0);
  const behind = parts[0] ?? 0;
  const ahead = parts[1] ?? 0;

  if (ahead === 0 && behind === 0) {
    return { kind: "synced", upstream, hash };
  }
  if (ahead > 0 && behind === 0) {
    return { kind: "ahead", upstream, ahead, hash };
  }
  if (behind > 0 && ahead === 0) {
    return { kind: "behind", upstream, behind, hash };
  }
  return { kind: "diverged", upstream, ahead, behind, hash };
}

export function headShort(): string {
  return runGit(["rev-parse", "--short", "HEAD"], { allowFailure: true })
    .stdout.trim();
}

function formatPushError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return "Push failed.";
  const lower = msg.toLowerCase();
  if (lower.includes("non-fast-forward") || lower.includes("fetch first")) {
    return `${msg}\nHint: remote is ahead — pull/rebase before pushing (rigit will not force-push).`;
  }
  if (
    lower.includes("authentication") ||
    lower.includes("permission denied") ||
    lower.includes("could not read username") ||
    lower.includes("403")
  ) {
    return `${msg}\nHint: check SSH keys or credentials (gh auth login / ssh -T git@github.com).`;
  }
  return msg;
}

/** Quick check that git binary exists */
export function ensureGitAvailable(): void {
  try {
    execFileSync("git", ["--version"], { encoding: "utf8", stdio: "pipe" });
  } catch {
    throw new Error(
      "git is not installed or not on PATH.\n" +
        "  Install:  sudo apt install git   ·   brew install git   ·   https://git-scm.com",
    );
  }
}

// --- Setup / repo health ---

export function initRepo(): void {
  runGit(["init"]);
}

export function hasCommits(): boolean {
  const { status } = runGit(["rev-parse", "--verify", "HEAD"], {
    allowFailure: true,
  });
  return status === 0;
}

export function getUserName(): string | undefined {
  const { stdout, status } = runGit(["config", "--get", "user.name"], {
    allowFailure: true,
  });
  if (status !== 0) return undefined;
  const v = stdout.trim();
  return v || undefined;
}

export function getUserEmail(): string | undefined {
  const { stdout, status } = runGit(["config", "--get", "user.email"], {
    allowFailure: true,
  });
  if (status !== 0) return undefined;
  const v = stdout.trim();
  return v || undefined;
}

export function hasIdentity(): boolean {
  return Boolean(getUserName() && getUserEmail());
}

export function setLocalIdentity(name: string, email: string): void {
  runGit(["config", "--local", "user.name", name.trim()]);
  runGit(["config", "--local", "user.email", email.trim()]);
}

export type RemoteInfo = { name: string; url: string };

export function listRemotes(): RemoteInfo[] {
  const { stdout, status } = runGit(["remote", "-v"], { allowFailure: true });
  if (status !== 0 || !stdout.trim()) return [];
  const map = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    // origin  https://... (fetch)
    const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
    if (m?.[1] && m[2]) map.set(m[1], m[2]);
  }
  return [...map.entries()].map(([name, url]) => ({ name, url }));
}

export function addRemote(name: string, url: string): void {
  const n = name.trim() || "origin";
  const u = url.trim();
  if (!u) throw new Error("Remote URL cannot be empty");
  if (hasRemote(n)) {
    runGit(["remote", "set-url", n, u]);
    return;
  }
  runGit(["remote", "add", n, u]);
}

export type RepoState =
  | { kind: "normal"; branch: string }
  | { kind: "empty"; branch: string }
  | { kind: "detached"; short: string }
  | { kind: "merge"; branch: string }
  | { kind: "rebase"; branch: string }
  | { kind: "cherry-pick"; branch: string }
  | { kind: "revert"; branch: string };

export function getRepoState(): RepoState {
  const branch = currentBranch();

  if (runGit(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { allowFailure: true }).status === 0) {
    return { kind: "merge", branch };
  }
  if (
    runGit(["rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD"], { allowFailure: true })
      .status === 0
  ) {
    return { kind: "cherry-pick", branch };
  }
  if (runGit(["rev-parse", "-q", "--verify", "REVERT_HEAD"], { allowFailure: true }).status === 0) {
    return { kind: "revert", branch };
  }

  const rebaseMerge = runGit(["rev-parse", "--git-path", "rebase-merge"], {
    allowFailure: true,
  }).stdout.trim();
  const rebaseApply = runGit(["rev-parse", "--git-path", "rebase-apply"], {
    allowFailure: true,
  }).stdout.trim();
  if ((rebaseMerge && existsSync(rebaseMerge)) || (rebaseApply && existsSync(rebaseApply))) {
    return { kind: "rebase", branch };
  }

  if (!hasCommits()) {
    return { kind: "empty", branch: branch === "HEAD" ? "main" : branch };
  }

  const { stdout: show } = runGit(["branch", "--show-current"], {
    allowFailure: true,
  });
  if (!show.trim()) {
    const short = runGit(["rev-parse", "--short", "HEAD"], {
      allowFailure: true,
    }).stdout.trim();
    return { kind: "detached", short: short || "unknown" };
  }

  return { kind: "normal", branch: show.trim() };
}

export function isIdentityError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("empty ident") ||
    m.includes("user.name") ||
    m.includes("user.email") ||
    m.includes("unable to auto-detect email") ||
    m.includes("please tell me who you are")
  );
}

export function cwdDisplay(): string {
  return process.cwd();
}

// --- Diff ---

export type DiffScope = "unstaged" | "staged" | "all";

function diffBaseArgs(scope: DiffScope, color: boolean): string[] {
  const args = ["diff"];
  if (color) args.push("--color=always");
  else args.push("--no-color");

  if (scope === "staged") {
    args.push("--cached");
  } else if (scope === "all") {
    // HEAD may not exist in an empty repo
    if (hasCommits()) {
      args.push("HEAD");
    }
    // else: same as unstaged (working tree vs index + we'll note untracked)
  }
  return args;
}

export function getDiffStat(
  scope: DiffScope,
  paths?: string[],
  color = false,
): string {
  const args = [...diffBaseArgs(scope, color), "--stat"];
  if (paths?.length) args.push("--", ...paths);
  return runGit(args, { allowFailure: true }).stdout.trim();
}

export function getDiffPatch(
  scope: DiffScope,
  paths?: string[],
  opts: { color?: boolean; maxChars?: number } = {},
): string {
  const color = opts.color ?? false;
  const maxChars = opts.maxChars ?? 30_000;
  const args = diffBaseArgs(scope, color);
  if (paths?.length) args.push("--", ...paths);
  let body = runGit(args, { allowFailure: true }).stdout.trim();
  if (body.length > maxChars) {
    body = body.slice(0, maxChars) + "\n…(truncated)";
  }
  return body;
}

/** Truncate by lines for terminal display. */
export function truncateLines(text: string, maxLines = 200): string {
  if (!text) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n…(${lines.length - maxLines} more lines truncated)`
  );
}

/**
 * Open full diff in the user's pager (stdio inherit).
 * Returns false if git failed.
 */
export function openDiffInPager(scope: DiffScope, paths?: string[]): boolean {
  const args = diffBaseArgs(scope, true);
  if (paths?.length) args.push("--", ...paths);
  const result = spawnSync("git", args, {
    stdio: "inherit",
    env: { ...process.env, GIT_PAGER: process.env.GIT_PAGER || "less -R" },
  });
  return (result.status ?? 1) === 0;
}

/** Untracked files are invisible to `git diff`; surface them for "all" / unstaged. */
export function getUntrackedPaths(): string[] {
  const { stdout } = runGit(
    ["ls-files", "--others", "--exclude-standard"],
    { allowFailure: true },
  );
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// --- Compare / side-by-side ---

/** Special pseudo-refs for compare UI */
export const COMPARE_WORKING = ":working";
export const COMPARE_STAGED = ":staged";

export type CompareKind = "refs" | "files";

export type CompareChoice = {
  id: string;
  label: string;
  hint?: string;
};

export type SideBySideRow = {
  left: string;
  right: string;
  kind: "context" | "delete" | "add" | "change" | "header" | "meta";
};

/** Branches + HEAD + working tree + staged + recent commits */
export function listRefCompareChoices(limit = 12): CompareChoice[] {
  const choices: CompareChoice[] = [
    { id: COMPARE_WORKING, label: "Working tree", hint: "disk" },
    { id: COMPARE_STAGED, label: "Staged (index)", hint: "index" },
  ];

  if (hasCommits()) {
    choices.push({ id: "HEAD", label: "HEAD", hint: "current" });
  }

  for (const b of listLocalBranches()) {
    if (b.name === "HEAD") continue;
    // Unborn branch still lists; comparing may be empty until first commit
    choices.push({
      id: b.name,
      label: b.name,
      hint: b.current ? "current branch" : b.upstream,
    });
  }

  if (hasCommits()) {
    const log = getRecentLog(limit);
    for (const line of log) {
      const hash = line.split(/\s+/)[0];
      if (!hash || hash === "HEAD") continue;
      if (choices.some((c) => c.id === hash)) continue;
      const rest = line.slice(hash.length).trim();
      choices.push({
        id: hash,
        label: hash,
        hint: rest.slice(0, 40),
      });
    }
  }

  return choices;
}

/** Tracked + untracked paths for file-vs-file compare */
export function listFileCompareChoices(extra: string[] = []): CompareChoice[] {
  const seen = new Set<string>();
  const out: CompareChoice[] = [];

  const add = (path: string, hint?: string) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({ id: path, label: path, hint });
  };

  for (const p of extra) add(p, "selected");
  for (const f of getChangedFiles()) add(f.path, statusLabel(f.status));

  const tracked = runGit(["ls-files"], { allowFailure: true }).stdout;
  for (const line of tracked.split("\n")) {
    add(line.trim(), "tracked");
    if (out.length >= 200) break;
  }

  return out;
}

export type ComparePatchResult = {
  patch: string;
  /** When true, swap left/right columns to match user pick order */
  swap: boolean;
};

/**
 * Diff two compare targets (refs/specials or two file paths).
 */
export function getComparePatch(
  kind: CompareKind,
  left: string,
  right: string,
  opts: { maxChars?: number } = {},
): ComparePatchResult {
  const maxChars = opts.maxChars ?? 40_000;
  let body: string;
  let swap = false;

  if (kind === "files") {
    const r = runGit(
      ["diff", "--no-index", "--no-color", "--", left, right],
      { allowFailure: true },
    );
    // git diff --no-index exits 1 when files differ
    body = (r.stdout || r.stderr).trim();
  } else {
    const result = diffBetweenRefs(left, right);
    body = result.patch;
    swap = result.swap;
  }

  if (body.length > maxChars) {
    body = body.slice(0, maxChars) + "\n…(truncated)";
  }
  return { patch: body, swap };
}

function diffBetweenRefs(
  left: string,
  right: string,
): { patch: string; swap: boolean } {
  const L = left;
  const R = right;

  // Both normal commits/branches: git diff A B → A is old (−), B is new (+)
  if (!isSpecial(L) && !isSpecial(R)) {
    return {
      patch: runGit(["diff", "--no-color", L, R], { allowFailure: true }).stdout.trim(),
      swap: false,
    };
  }

  // ref vs working: git diff REF → REF (−), working (+)
  if (!isSpecial(L) && R === COMPARE_WORKING) {
    return {
      patch: runGit(["diff", "--no-color", L], { allowFailure: true }).stdout.trim(),
      swap: false,
    };
  }
  if (L === COMPARE_WORKING && !isSpecial(R)) {
    // want working (−), R (+) but git diff R is R (−), working (+)
    return {
      patch: runGit(["diff", "--no-color", R], { allowFailure: true }).stdout.trim(),
      swap: true,
    };
  }

  // ref vs staged: git diff --cached REF → REF (−), index (+)
  if (!isSpecial(L) && R === COMPARE_STAGED) {
    return {
      patch: runGit(["diff", "--no-color", "--cached", L], {
        allowFailure: true,
      }).stdout.trim(),
      swap: false,
    };
  }
  if (L === COMPARE_STAGED && !isSpecial(R)) {
    return {
      patch: runGit(["diff", "--no-color", "--cached", R], {
        allowFailure: true,
      }).stdout.trim(),
      swap: true,
    };
  }

  // staged vs working: git diff → index (−), working (+)
  if (L === COMPARE_STAGED && R === COMPARE_WORKING) {
    return {
      patch: runGit(["diff", "--no-color"], { allowFailure: true }).stdout.trim(),
      swap: false,
    };
  }
  if (L === COMPARE_WORKING && R === COMPARE_STAGED) {
    return {
      patch: runGit(["diff", "--no-color"], { allowFailure: true }).stdout.trim(),
      swap: true,
    };
  }

  if (L === R) {
    return { patch: "", swap: false };
  }

  return {
    patch: runGit(["diff", "--no-color", L, R], { allowFailure: true }).stdout.trim(),
    swap: false,
  };
}

function isSpecial(id: string): boolean {
  return id === COMPARE_WORKING || id === COMPARE_STAGED;
}

export function compareLabel(id: string): string {
  if (id === COMPARE_WORKING) return "Working tree";
  if (id === COMPARE_STAGED) return "Staged";
  return id;
}

/**
 * Convert a unified diff into side-by-side rows.
 * Deletions → left (red), additions → right (green), changes aligned.
 */
export function unifiedToSideBySide(
  patch: string,
  swap = false,
): SideBySideRow[] {
  if (!patch.trim()) {
    return [{ left: "(no differences)", right: "", kind: "meta" }];
  }

  const rows: SideBySideRow[] = [];
  const dels: string[] = [];

  const flushDels = () => {
    while (dels.length) {
      rows.push({ left: dels.shift()!, right: "", kind: "delete" });
    }
  };

  for (const raw of patch.split("\n")) {
    const line = raw;
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("similarity ") ||
      line.startsWith("rename ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("@@")
    ) {
      flushDels();
      rows.push({ left: line, right: "", kind: "header" });
      continue;
    }

    if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      flushDels();
      rows.push({ left: line, right: "", kind: "meta" });
      continue;
    }

    if (line.startsWith("-")) {
      dels.push(line.slice(1));
      continue;
    }

    if (line.startsWith("+")) {
      const add = line.slice(1);
      if (dels.length) {
        rows.push({ left: dels.shift()!, right: add, kind: "change" });
      } else {
        rows.push({ left: "", right: add, kind: "add" });
      }
      continue;
    }

    flushDels();
    const content = line.startsWith(" ") ? line.slice(1) : line;
    rows.push({ left: content, right: content, kind: "context" });
  }
  flushDels();

  if (!swap) return rows;

  return rows.map((r) => {
    if (r.kind === "header" || r.kind === "meta") return r;
    let kind = r.kind;
    if (kind === "delete") kind = "add";
    else if (kind === "add") kind = "delete";
    return { left: r.right, right: r.left, kind };
  });
}

export function openCompareInPager(
  kind: CompareKind,
  left: string,
  right: string,
): boolean {
  let args: string[];
  if (kind === "files") {
    args = ["diff", "--no-index", "--color=always", "--", left, right];
  } else if (!isSpecial(left) && !isSpecial(right)) {
    args = ["diff", "--color=always", left, right];
  } else if (!isSpecial(left) && right === COMPARE_WORKING) {
    args = ["diff", "--color=always", left];
  } else if (left === COMPARE_WORKING && !isSpecial(right)) {
    args = ["diff", "--color=always", right];
  } else if (!isSpecial(left) && right === COMPARE_STAGED) {
    args = ["diff", "--color=always", "--cached", left];
  } else if (
    (left === COMPARE_STAGED && right === COMPARE_WORKING) ||
    (left === COMPARE_WORKING && right === COMPARE_STAGED)
  ) {
    args = ["diff", "--color=always"];
  } else {
    args = ["diff", "--color=always", left, right];
  }

  const result = spawnSync("git", args, {
    stdio: "inherit",
    env: { ...process.env, GIT_PAGER: process.env.GIT_PAGER || "less -R" },
  });
  // --no-index returns 1 on diff
  return result.status === 0 || result.status === 1;
}

// --- Branches ---

export type BranchInfo = {
  name: string;
  current: boolean;
  upstream?: string;
};

export function listLocalBranches(): BranchInfo[] {
  const format = "%(refname:short)\t%(upstream:short)\t%(HEAD)";
  const { stdout, status } = runGit(
    ["branch", "--format=" + format],
    { allowFailure: true },
  );
  if (status !== 0 || !stdout.trim()) {
    const cur = currentBranch();
    return cur && cur !== "HEAD" ? [{ name: cur, current: true }] : [];
  }

  const branches: BranchInfo[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [name, upstream, head] = line.split("\t");
    if (!name) continue;
    branches.push({
      name,
      current: (head ?? "").trim() === "*",
      upstream: upstream || undefined,
    });
  }
  return branches;
}

export function switchBranch(name: string): void {
  const sw = runGit(["switch", name], { allowFailure: true });
  if (sw.status === 0) return;

  const co = runGit(["checkout", name], { allowFailure: true });
  if (co.status === 0) return;

  const msg = (sw.stderr || sw.stdout || co.stderr || co.stdout || `Failed to switch to ${name}`).trim();
  throw new Error(msg);
}

export function createBranch(name: string, checkout: boolean): void {
  if (checkout) {
    const r = runGit(["switch", "-c", name], { allowFailure: true });
    if (r.status === 0) return;
    // fallback
    const r2 = runGit(["checkout", "-b", name], { allowFailure: true });
    if (r2.status === 0) return;
    throw new Error(
      (r.stderr || r.stdout || r2.stderr || r2.stdout || `Failed to create ${name}`).trim(),
    );
  }

  const r = runGit(["branch", name], { allowFailure: true });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `Failed to create ${name}`).trim());
  }
}

export function isValidBranchName(name: string): string | undefined {
  const n = name.trim();
  if (!n) return "Branch name cannot be empty";
  if (/\s/.test(n)) return "Branch name cannot contain spaces";
  if (n.startsWith("-")) return "Branch name cannot start with -";
  if (n.includes("..") || n.includes("~") || n.includes("^") || n.includes(":")) {
    return "Branch name contains invalid characters";
  }
  // git check-ref-format
  const r = runGit(["check-ref-format", "--branch", n], { allowFailure: true });
  if (r.status !== 0) return "Invalid branch name";
  return undefined;
}

// --- Log ---

export function getRecentLog(limit = 15): string[] {
  const { stdout, status } = runGit(
    ["log", `--oneline`, `-n`, String(limit), "--decorate", "--color=never"],
    { allowFailure: true },
  );
  if (status !== 0 || !stdout.trim()) return [];
  return stdout
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

