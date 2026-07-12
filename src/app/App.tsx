import { useCallback, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TabBar } from "./components/TabBar.js";
import { CommitTab } from "./tabs/CommitTab.js";
import { BranchesTab } from "./tabs/BranchesTab.js";
import { DiffTab } from "./tabs/DiffTab.js";
import { LogTab } from "./tabs/LogTab.js";
import { nextTab, prevTab, type TabId } from "./tabs.js";
import { currentBranch, getChangedFiles, type ChangedFile } from "../git.js";

export function App() {
  const { exit } = useApp();
  const [tab, setTab] = useState<TabId>("commit");
  const [branch, setBranch] = useState(() => currentBranch());
  const [files, setFiles] = useState<ChangedFile[]>(() => getChangedFiles());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  /** When true, tabs own typing (text inputs) — don't steal tab/q aggressively for inputs */
  const [inputMode, setInputMode] = useState(false);

  // Track input mode by polling tab internal steps is hard; use a simple approach:
  // App always handles tab/shift+tab/q except we pass captureKeys=true always for list modes.
  // Text inputs: CommitTab/BranchesTab handle esc; we still allow tab to switch tabs from inputs.

  const refreshFiles = useCallback(() => {
    const next = getChangedFiles();
    setFiles(next);
    setSelected((prev) => {
      const paths = new Set(next.map((f) => f.path));
      const kept = new Set<string>();
      for (const p of prev) {
        if (paths.has(p)) kept.add(p);
      }
      return kept;
    });
  }, []);

  const refreshBranch = useCallback(() => {
    setBranch(currentBranch());
    refreshFiles();
  }, [refreshFiles]);

  useInput((input, key) => {
    if (key.tab) {
      setInputMode(false);
      setTab((t) => (key.shift ? prevTab(t) : nextTab(t)));
      return;
    }
    if ((input === "q" || input === "Q") && !inputMode) {
      exit();
    }
    if (key.escape && !inputMode) {
      exit();
    }
  });

  // Children set input mode via context would be cleaner; use lightweight prop callbacks:
  const selectedList = useMemo(() => [...selected], [selected]);
  const allPaths = useMemo(() => files.map((f) => f.path), [files]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text>
          <Text backgroundColor="cyan" color="black" bold>
            {" "}
            rigit{" "}
          </Text>
          <Text dimColor> · {branch}</Text>
        </Text>
        <Text dimColor>tab switch · q quit</Text>
      </Box>

      <Box marginY={1}>
        <TabBar active={tab} />
      </Box>

      <CommitTab
        active={tab === "commit"}
        files={files}
        selected={selected}
        setSelected={setSelected}
        onRefresh={refreshFiles}
        captureKeys={tab === "commit"}
        onInputMode={setInputMode}
      />
      <BranchesTab
        active={tab === "branches"}
        captureKeys={tab === "branches"}
        onBranchChange={refreshBranch}
        onInputMode={setInputMode}
      />
      <DiffTab
        active={tab === "diff"}
        captureKeys={tab === "diff"}
        selectedPaths={selectedList}
        allPaths={allPaths}
      />
      <LogTab active={tab === "log"} captureKeys={tab === "log"} />
    </Box>
  );
}
