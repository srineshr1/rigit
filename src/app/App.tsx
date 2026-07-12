import { useCallback, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TabBar } from "./components/TabBar.js";
import { RepoBanner } from "./components/RepoBanner.js";
import {
  ActivityBanner,
  type Activity,
} from "./components/ActivityBanner.js";
import { CommitTab } from "./tabs/CommitTab.js";
import { BranchesTab } from "./tabs/BranchesTab.js";
import { DiffTab } from "./tabs/DiffTab.js";
import { LogTab } from "./tabs/LogTab.js";
import { nextTab, prevTab, type TabId } from "./tabs.js";
import {
  currentBranch,
  getChangedFiles,
  getRepoState,
  getSyncStatus,
  type ChangedFile,
  type RepoState,
  type SyncStatus,
} from "../git.js";

export function App() {
  const { exit } = useApp();
  const [tab, setTab] = useState<TabId>("commit");
  const [branch, setBranch] = useState(() => currentBranch());
  const [repoState, setRepoState] = useState<RepoState>(() => getRepoState());
  const [sync, setSync] = useState<SyncStatus>(() => getSyncStatus());
  const [activity, setActivity] = useState<Activity | undefined>();
  const [files, setFiles] = useState<ChangedFile[]>(() => getChangedFiles());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [inputMode, setInputMode] = useState(false);

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

  const refreshRepo = useCallback(() => {
    setBranch(currentBranch());
    setRepoState(getRepoState());
    setSync(getSyncStatus());
    refreshFiles();
  }, [refreshFiles]);

  const onActivity = useCallback((a: Activity) => {
    setActivity(a);
    setSync(getSyncStatus());
  }, []);

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

      <ActivityBanner activity={activity} sync={sync} />
      <RepoBanner state={repoState} />

      <CommitTab
        active={tab === "commit"}
        files={files}
        selected={selected}
        setSelected={setSelected}
        onRefresh={refreshFiles}
        captureKeys={tab === "commit"}
        onInputMode={setInputMode}
        onRepoChanged={refreshRepo}
        onActivity={onActivity}
      />
      <BranchesTab
        active={tab === "branches"}
        captureKeys={tab === "branches"}
        onBranchChange={refreshRepo}
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
