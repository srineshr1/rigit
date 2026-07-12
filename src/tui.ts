import React, { useCallback, useState } from "react";
import { render } from "ink";
import { App } from "./app/App.js";
import { detectSetupNeeds, SetupApp } from "./setup/SetupApp.js";
import { runPreflight } from "./setup/preflight.js";
import { hasIdentity, isGitRepo } from "./git.js";

function Root() {
  const [ready, setReady] = useState(() => {
    if (!isGitRepo()) return false;
    if (!hasIdentity()) return false;
    return true;
  });
  const [needs] = useState(() => detectSetupNeeds());

  const onReady = useCallback(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return React.createElement(SetupApp, { needs, onReady });
  }
  return React.createElement(App);
}

export async function runTui(): Promise<void> {
  const pre = runPreflight();
  if (!pre.ok) {
    console.error(`rigit: ${pre.message}`);
    process.exitCode = 1;
    return;
  }

  const instance = render(React.createElement(Root));
  await instance.waitUntilExit();
}
