import React from "react";
import { render } from "ink";
import { applyConfigToEnv, loadConfig } from "../config.js";
import { runGhAuthLogin } from "../github.js";
import { ConfigSetupApp, type SetupResult } from "./ConfigSetupApp.js";

/**
 * Interactive `rigit setup` loop.
 * Handles gh auth login outside Ink so the TTY is free.
 */
export async function runConfigSetup(): Promise<void> {
  applyConfigToEnv(loadConfig());

  let next: SetupResult = "quit";

  do {
    next = await openSetupUi();
    if (next === "gh-login") {
      const result = runGhAuthLogin();
      console.log(result.ok ? `\n✓ ${result.detail}\n` : `\n✗ ${result.detail}\n`);
      // loop back into setup UI
      next = "gh-login"; // continue loop
      // re-open UI
      continue;
    }
  } while (next === "gh-login");
}

function openSetupUi(): Promise<SetupResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: SetupResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = render(
      React.createElement(ConfigSetupApp, {
        onFinish: (result: SetupResult) => {
          done(result);
        },
      }),
    );

    void instance.waitUntilExit().then(() => {
      // If exited without onFinish (e.g. Ctrl+C), treat as quit
      done("quit");
    });
  });
}
