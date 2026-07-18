import { applyConfigToEnv, loadConfig } from "./config.js";
import { runConfigSetup } from "./setup/runConfigSetup.js";
import { runTui } from "./tui.js";

function printHelp(): void {
  console.log(`rigit — tabbed git TUI

Usage:
  rigit              Open the TUI (stage / commit / push / …)
  rigit setup        Configure AI keys, GitHub (gh / token)
  rigit help         Show this help

Config file:
  ~/.config/rigit/config.json

Environment (optional; overrides config file):
  XAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY / GOOGLE_API_KEY
  RIGIT_AI_PROVIDER, RIGIT_AI_MODEL
  GITHUB_TOKEN / GH_TOKEN
`);
}

async function main(): Promise<void> {
  // Load ~/.config/rigit/config.json into env (without overriding existing env)
  applyConfigToEnv(loadConfig());

  const arg = process.argv[2]?.trim().toLowerCase();

  try {
    if (arg === "help" || arg === "-h" || arg === "--help") {
      printHelp();
      return;
    }
    if (arg === "setup" || arg === "config" || arg === "init") {
      await runConfigSetup();
      return;
    }
    if (arg && arg !== "--") {
      console.error(`rigit: unknown command '${arg}'`);
      printHelp();
      process.exitCode = 1;
      return;
    }

    await runTui();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`rigit: ${msg}`);
    process.exitCode = 1;
  }
}

main();
