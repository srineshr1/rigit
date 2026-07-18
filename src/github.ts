import { spawnSync } from "node:child_process";

export type GhStatus =
  | { ok: true; loggedIn: true; user?: string; detail: string }
  | { ok: true; loggedIn: false; detail: string }
  | { ok: false; installed: false; detail: string }
  | { ok: false; installed: true; detail: string };

export function isGhInstalled(): boolean {
  const r = spawnSync("gh", ["--version"], { encoding: "utf8" });
  return (r.status ?? 1) === 0;
}

export function getGhAuthStatus(): GhStatus {
  if (!isGhInstalled()) {
    return {
      ok: false,
      installed: false,
      detail:
        "GitHub CLI (gh) is not installed.\n  https://cli.github.com/  ·  brew install gh  ·  sudo apt install gh",
    };
  }

  const r = spawnSync("gh", ["auth", "status"], {
    encoding: "utf8",
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();

  if ((r.status ?? 1) === 0) {
    const userMatch = out.match(/Logged in to [^\s]+ account (\S+)/i)
      ?? out.match(/account (\S+)/i);
    return {
      ok: true,
      loggedIn: true,
      user: userMatch?.[1],
      detail: out || "Logged in to GitHub via gh.",
    };
  }

  return {
    ok: true,
    loggedIn: false,
    detail: out || "Not logged in. Run: gh auth login",
  };
}

/** Interactive browser/device login (stdio inherit). */
export function runGhAuthLogin(): { ok: boolean; detail: string } {
  if (!isGhInstalled()) {
    return {
      ok: false,
      detail:
        "gh is not installed. Install from https://cli.github.com/ then retry.",
    };
  }

  console.log("\n── GitHub CLI login ─────────────────────────────\n");
  const r = spawnSync("gh", ["auth", "login"], {
    stdio: "inherit",
    encoding: "utf8",
  });

  if ((r.status ?? 1) === 0) {
    return { ok: true, detail: "gh auth login finished." };
  }
  return {
    ok: false,
    detail: `gh auth login exited with code ${r.status ?? 1}.`,
  };
}

export function hasGithubTokenInEnv(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim(),
  );
}
