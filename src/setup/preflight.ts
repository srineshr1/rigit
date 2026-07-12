import { ensureGitAvailable } from "../git.js";

export type PreflightOk = { ok: true };
export type PreflightFail = { ok: false; message: string };
export type PreflightResult = PreflightOk | PreflightFail;

/**
 * Non-interactive checks that must pass before any Ink UI.
 */
export function runPreflight(): PreflightResult {
  try {
    ensureGitAvailable();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return {
      ok: false,
      message:
        "rigit needs an interactive terminal (TTY).\n" +
        "  Run it directly in a terminal, not piped or in non-interactive CI.",
    };
  }

  return { ok: true };
}
