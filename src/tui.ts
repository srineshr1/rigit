import React from "react";
import { render } from "ink";
import { App } from "./app/App.js";
import { isGitRepo } from "./git.js";

export async function runTui(): Promise<void> {
  if (!isGitRepo()) {
    console.error("rigit: not a git repository. Run this inside a repo.");
    process.exitCode = 1;
    return;
  }

  const instance = render(React.createElement(App));
  await instance.waitUntilExit();
}
