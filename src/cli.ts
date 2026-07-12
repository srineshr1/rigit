import { ensureGitAvailable } from "./git.js";
import { runTui } from "./tui.js";

async function main(): Promise<void> {
  try {
    ensureGitAvailable();
    await runTui();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`rigit: ${msg}`);
    process.exitCode = 1;
  }
}

main();
