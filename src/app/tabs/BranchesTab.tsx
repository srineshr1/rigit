import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { StatusBar } from "../components/StatusBar.js";
import { TextPrompt } from "../components/TextPrompt.js";
import {
  createBranch,
  currentBranch,
  isValidBranchName,
  listLocalBranches,
  switchBranch,
  type BranchInfo,
} from "../../git.js";

type Mode = "list" | "create-name" | "create-checkout" | "busy";

type Props = {
  active: boolean;
  captureKeys: boolean;
  onBranchChange: () => void;
  onInputMode?: (v: boolean) => void;
};

export function BranchesTab({
  active,
  captureKeys,
  onBranchChange,
  onInputMode,
}: Props) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busyLabel, setBusyLabel] = useState("");

  const goMode = (m: Mode) => {
    setMode(m);
    onInputMode?.(m === "create-name");
  };

  const reload = useCallback(() => {
    const list = listLocalBranches();
    setBranches(list);
    const curIdx = list.findIndex((b) => b.current);
    setCursor(curIdx >= 0 ? curIdx : 0);
  }, []);

  useEffect(() => {
    if (active) reload();
  }, [active, reload]);

  const doSwitch = useCallback(
    (branchName: string) => {
      if (branchName === currentBranch()) {
        setStatus(`Already on ${branchName}.`);
        return;
      }
      goMode("busy");
      setBusyLabel(`Switching to ${branchName}…`);
      setError(undefined);
      try {
        switchBranch(branchName);
        setStatus(`Switched to ${branchName}.`);
        reload();
        onBranchChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      goMode("list");
    },
    [reload, onBranchChange, onInputMode],
  );

  const doCreate = useCallback(
    (branchName: string, checkout: boolean) => {
      const invalid = isValidBranchName(branchName);
      if (invalid) {
        setError(invalid);
        goMode("create-name");
        return;
      }
      goMode("busy");
      setBusyLabel(
        checkout
          ? `Creating and switching to ${branchName}…`
          : `Creating ${branchName}…`,
      );
      setError(undefined);
      try {
        createBranch(branchName.trim(), checkout);
        setStatus(
          checkout
            ? `Created and switched to ${branchName.trim()}.`
            : `Created ${branchName.trim()}.`,
        );
        setName("");
        reload();
        onBranchChange();
        goMode("list");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        goMode("create-name");
      }
    },
    [reload, onBranchChange, onInputMode],
  );

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;
      if (mode === "busy") return;

      if (mode === "create-name") {
        if (key.escape) {
          goMode("list");
          setError(undefined);
        }
        return;
      }

      if (mode === "create-checkout") {
        if (input === "y" || input === "Y" || key.return) {
          doCreate(name, true);
        } else if (input === "n" || input === "N") {
          doCreate(name, false);
        } else if (key.escape) {
          goMode("list");
        }
        return;
      }

      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(Math.max(0, branches.length - 1), c + 1));
      } else if (key.return) {
        const b = branches[cursor];
        if (b) doSwitch(b.name);
      } else if (input === "n" || input === "N") {
        setName("");
        setError(undefined);
        goMode("create-name");
      } else if (input === "r" || input === "R") {
        reload();
        setStatus("Refreshed.");
      }
    },
    { isActive: active && captureKeys },
  );

  if (!active) return null;

  return (
    <Box flexDirection="column">
      {mode === "list" && (
        <>
          <Text dimColor>
            On {currentBranch()} · {branches.length} local
          </Text>
          {branches.map((b, i) => {
            const focused = i === cursor;
            return (
              <Box key={b.name}>
                <Text color={focused ? "cyan" : undefined}>
                  {focused ? "❯" : " "} {b.current ? "* " : "  "}
                  {b.name}
                </Text>
                {b.upstream ? (
                  <Text dimColor>
                    {"  "}→ {b.upstream}
                  </Text>
                ) : null}
              </Box>
            );
          })}
          <StatusBar
            hints="↑↓ move · enter switch · n new · r refresh · tab switch · q quit"
            message={status}
            error={error}
          />
        </>
      )}

      {mode === "busy" && <Text color="yellow">{busyLabel}</Text>}

      {mode === "create-name" && (
        <Box flexDirection="column">
          <TextPrompt
            label="New branch name"
            value={name}
            placeholder="feature/my-change"
            onChange={setName}
            onSubmit={(v) => {
              const invalid = isValidBranchName(v);
              if (invalid) {
                setError(invalid);
                return;
              }
              setName(v);
              setMode("create-checkout");
            }}
            focus
          />
          <StatusBar hints="enter continue · esc cancel" error={error} />
        </Box>
      )}

      {mode === "create-checkout" && (
        <Box flexDirection="column">
          <Text>
            Switch to <Text color="cyan">{name.trim()}</Text>?{" "}
            <Text bold color="cyan">
              [Y]
            </Text>
            es /{" "}
            <Text bold color="cyan">
              [N]
            </Text>
            o
          </Text>
          <StatusBar hints="y checkout · n create only · esc cancel" error={error} />
        </Box>
      )}
    </Box>
  );
}
