import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { FileList } from "../components/FileList.js";
import { StatusBar } from "../components/StatusBar.js";
import { TextPrompt } from "../components/TextPrompt.js";
import {
  commit,
  currentBranch,
  getStagedDiffForAi,
  getStagedDiffSummary,
  push,
  stageFiles,
  type ChangedFile,
} from "../../git.js";
import { generateCommitMessage } from "../../message.js";

type Step = "list" | "message" | "push" | "busy";

type Props = {
  active: boolean;
  files: ChangedFile[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onRefresh: () => void;
  captureKeys: boolean;
  onInputMode?: (v: boolean) => void;
};

export function CommitTab({
  active,
  files,
  selected,
  setSelected,
  onRefresh,
  captureKeys,
  onInputMode,
}: Props) {
  const [cursor, setCursor] = useState(0);
  const [step, setStep] = useState<Step>("list");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busyLabel, setBusyLabel] = useState("");

  const goStep = (s: Step) => {
    setStep(s);
    onInputMode?.(s === "message");
  };

  const maxCursor = files.length; // 0 = All, 1..n = files

  useEffect(() => {
    setCursor((c) => Math.min(c, maxCursor));
  }, [maxCursor]);

  useEffect(() => {
    if (!active && step !== "list") {
      goStep("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when leaving tab
  }, [active]);

  const toggleAll = useCallback(() => {
    const allOn =
      files.length > 0 && files.every((f) => selected.has(f.path));
    if (allOn) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.path)));
    }
  }, [files, selected, setSelected]);

  const toggleAt = useCallback(
    (index: number) => {
      if (index === 0) {
        toggleAll();
        return;
      }
      const file = files[index - 1];
      if (!file) return;
      const next = new Set(selected);
      if (next.has(file.path)) next.delete(file.path);
      else next.add(file.path);
      setSelected(next);
    },
    [files, selected, setSelected, toggleAll],
  );

  const beginCommit = useCallback(async () => {
    const paths = [...selected];
    if (paths.length === 0) {
      setError("Select at least one file (space or a for all).");
      return;
    }
    setError(undefined);
    setStatus(undefined);
    goStep("busy");
    setBusyLabel("Staging files…");
    try {
      const allOn = files.length > 0 && paths.length === files.length;
      stageFiles(allOn ? "all" : paths);
      setBusyLabel("Generating commit message…");
      const summary = getStagedDiffSummary();
      const forAi = getStagedDiffForAi();
      const suggested = await generateCommitMessage(paths, summary, forAi);
      setMessage(suggested);
      goStep("message");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      goStep("list");
    }
  }, [selected, files, onInputMode]);

  const doCommit = useCallback(
    async (msg: string) => {
      const trimmed = msg.trim();
      if (!trimmed) {
        setError("Message cannot be empty.");
        return;
      }
      setError(undefined);
      goStep("busy");
      setBusyLabel("Committing…");
      try {
        const hash = commit(trimmed);
        setStatus(`Committed ${hash} — ${trimmed}`);
        goStep("push");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        goStep("message");
      }
    },
    [onInputMode],
  );

  const doPush = useCallback((yes: boolean) => {
    if (!yes) {
      setStatus((s) => `${s ?? "Committed"} (not pushed).`);
      goStep("list");
      setSelected(new Set());
      onRefresh();
      return;
    }
    goStep("busy");
    setBusyLabel("Pushing…");
    try {
      const result = push();
      if (result.ok) {
        setStatus(`Pushed on ${currentBranch()}.`);
      } else {
        setError(result.error);
        setStatus((s) => `${s ?? "Committed"} but push failed.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    goStep("list");
    setSelected(new Set());
    onRefresh();
  }, [onRefresh, setSelected, onInputMode]);

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;

      if (step === "busy") return;

      if (step === "message") {
        // TextInput handles typing; only catch escape to cancel
        if (key.escape) {
          goStep("list");
          setError(undefined);
        }
        return;
      }

      if (step === "push") {
        if (input === "y" || input === "Y" || key.return) {
          doPush(true);
        } else if (input === "n" || input === "N" || key.escape) {
          doPush(false);
        }
        return;
      }

      // list step
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(maxCursor, c + 1));
      } else if (input === " ") {
        toggleAt(cursor);
      } else if (input === "a" || input === "A") {
        toggleAll();
      } else if (input === "r" || input === "R") {
        onRefresh();
        setStatus("Refreshed.");
        setError(undefined);
      } else if (key.return) {
        void beginCommit();
      }
    },
    { isActive: active && captureKeys },
  );

  if (!active) return null;

  return (
    <Box flexDirection="column">
      {step === "list" && (
        <>
          <FileList files={files} selected={selected} cursor={cursor} />
          <StatusBar
            hints="↑↓ move · space toggle · a all/none · enter commit · r refresh · tab switch · q quit"
            message={status}
            error={error}
          />
        </>
      )}

      {step === "busy" && (
        <Box>
          <Text color="yellow">{busyLabel}</Text>
        </Box>
      )}

      {step === "message" && (
        <Box flexDirection="column">
          <TextPrompt
            label="Commit message"
            value={message}
            onChange={setMessage}
            onSubmit={(v) => void doCommit(v)}
            focus
          />
          <StatusBar
            hints="enter confirm · esc cancel"
            error={error}
          />
        </Box>
      )}

      {step === "push" && (
        <Box flexDirection="column">
          <Text>{status}</Text>
          <Text>
            Push to remote?{" "}
            <Text color="cyan" bold>
              [Y]
            </Text>
            es /{" "}
            <Text color="cyan" bold>
              [N]
            </Text>
            o
          </Text>
          <StatusBar hints="y push · n skip · enter = yes" error={error} />
        </Box>
      )}
    </Box>
  );
}

