import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { FileList } from "../components/FileList.js";
import { StatusBar } from "../components/StatusBar.js";
import { TextPrompt } from "../components/TextPrompt.js";
import {
  addRemote,
  commit,
  currentBranch,
  getStagedDiffForAi,
  getStagedDiffSummary,
  hasIdentity,
  isIdentityError,
  push,
  setLocalIdentity,
  stageFiles,
  type ChangedFile,
} from "../../git.js";
import { generateCommitMessage } from "../../message.js";

type Step =
  | "list"
  | "message"
  | "push"
  | "busy"
  | "identity-name"
  | "identity-email"
  | "remote-name"
  | "remote-url";

type Props = {
  active: boolean;
  files: ChangedFile[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onRefresh: () => void;
  captureKeys: boolean;
  onInputMode?: (v: boolean) => void;
  onRepoChanged?: () => void;
};

function isInputStep(s: Step): boolean {
  return (
    s === "message" ||
    s === "identity-name" ||
    s === "identity-email" ||
    s === "remote-name" ||
    s === "remote-url"
  );
}

export function CommitTab({
  active,
  files,
  selected,
  setSelected,
  onRefresh,
  captureKeys,
  onInputMode,
  onRepoChanged,
}: Props) {
  const [cursor, setCursor] = useState(0);
  const [step, setStep] = useState<Step>("list");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busyLabel, setBusyLabel] = useState("");
  const [identName, setIdentName] = useState("");
  const [identEmail, setIdentEmail] = useState("");
  const [remoteName, setRemoteName] = useState("origin");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | undefined>();

  const goStep = useCallback(
    (s: Step) => {
      setStep(s);
      onInputMode?.(isInputStep(s));
    },
    [onInputMode],
  );

  const maxCursor = files.length;

  useEffect(() => {
    setCursor((c) => Math.min(c, maxCursor));
  }, [maxCursor]);

  useEffect(() => {
    if (!active && step !== "list") {
      goStep("list");
    }
  }, [active, step, goStep]);

  const toggleAll = useCallback(() => {
    const allOn =
      files.length > 0 && files.every((f) => selected.has(f.path));
    if (allOn) setSelected(new Set());
    else setSelected(new Set(files.map((f) => f.path)));
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

  const finishAfterCommit = useCallback(() => {
    goStep("list");
    setSelected(new Set());
    onRefresh();
    onRepoChanged?.();
  }, [goStep, onRefresh, setSelected, onRepoChanged]);

  const runCommitWithMessage = useCallback(
    (trimmed: string) => {
      goStep("busy");
      setBusyLabel("Committing…");
      try {
        const hash = commit(trimmed);
        setStatus(`Committed ${hash} — ${trimmed}`);
        setPendingMessage(undefined);
        onRepoChanged?.();
        goStep("push");
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        if (isIdentityError(text)) {
          setPendingMessage(trimmed);
          setError("Git needs your name and email for commits.");
          goStep("identity-name");
          return;
        }
        setError(text);
        goStep("message");
      }
    },
    [goStep, onRepoChanged],
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
  }, [selected, files, goStep]);

  const doCommit = useCallback(
    (msg: string) => {
      const trimmed = msg.trim();
      if (!trimmed) {
        setError("Message cannot be empty.");
        return;
      }
      if (!hasIdentity()) {
        setPendingMessage(trimmed);
        setError(undefined);
        goStep("identity-name");
        return;
      }
      setError(undefined);
      runCommitWithMessage(trimmed);
    },
    [goStep, runCommitWithMessage],
  );

  const doPush = useCallback(
    (yes: boolean) => {
      if (!yes) {
        setStatus((s) => `${s ?? "Committed"} (not pushed).`);
        finishAfterCommit();
        return;
      }
      goStep("busy");
      setBusyLabel("Pushing…");
      try {
        const result = push();
        if (result.ok) {
          setStatus(`Pushed on ${currentBranch()}.`);
          finishAfterCommit();
          return;
        }
        if (result.code === "no_remote") {
          setError(undefined);
          setStatus("No remote configured. Add one to push.");
          setRemoteName("origin");
          setRemoteUrl("");
          goStep("remote-name");
          return;
        }
        setError(result.error);
        setStatus((s) => `${s ?? "Committed"} but push failed.`);
        finishAfterCommit();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        finishAfterCommit();
      }
    },
    [finishAfterCommit, goStep],
  );

  const addRemoteAndPush = useCallback(
    (name: string, url: string) => {
      const n = name.trim() || "origin";
      const u = url.trim();
      if (!u) {
        setError("Remote URL cannot be empty.");
        return;
      }
      goStep("busy");
      setBusyLabel("Adding remote and pushing…");
      try {
        addRemote(n, u);
        const result = push();
        if (result.ok) {
          setStatus(`Remote ${n} added · pushed on ${currentBranch()}.`);
        } else {
          setError(result.error);
          setStatus(`Remote ${n} added · push failed (commit is local).`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Committed locally; could not add remote / push.");
      }
      finishAfterCommit();
    },
    [finishAfterCommit, goStep],
  );

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;
      if (step === "busy") return;

      if (step === "message") {
        if (key.escape) {
          goStep("list");
          setError(undefined);
        }
        return;
      }

      if (step === "identity-name" || step === "identity-email") {
        if (key.escape) {
          setError("Commit cancelled (identity not set). Files remain staged.");
          goStep("list");
        }
        return;
      }

      if (step === "remote-name" || step === "remote-url") {
        if (key.escape) {
          setStatus((s) => `${s ?? "Committed"} (not pushed — no remote).`);
          finishAfterCommit();
        }
        return;
      }

      if (step === "push") {
        if (input === "y" || input === "Y" || key.return) doPush(true);
        else if (input === "n" || input === "N" || key.escape) doPush(false);
        return;
      }

      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(maxCursor, c + 1));
      else if (input === " ") toggleAt(cursor);
      else if (input === "a" || input === "A") toggleAll();
      else if (input === "r" || input === "R") {
        onRefresh();
        setStatus("Refreshed.");
        setError(undefined);
      } else if (key.return) void beginCommit();
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
            hints="↑↓ move · space toggle · a all/none · enter commit · r refresh · tab · q"
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
            onSubmit={(v) => doCommit(v)}
            focus
          />
          <StatusBar hints="enter confirm · esc cancel" error={error} />
        </Box>
      )}

      {step === "identity-name" && (
        <Box flexDirection="column">
          <Text>Git needs your identity to create commits.</Text>
          <Text dimColor>Saved with git config --local (this repo only).</Text>
          <TextPrompt
            label="Your name"
            value={identName}
            placeholder="Ada Lovelace"
            onChange={setIdentName}
            onSubmit={(v) => {
              if (!v.trim()) {
                setError("Name cannot be empty.");
                return;
              }
              setIdentName(v.trim());
              setError(undefined);
              goStep("identity-email");
            }}
            focus
          />
          <StatusBar hints="enter continue · esc cancel commit" error={error} />
        </Box>
      )}

      {step === "identity-email" && (
        <Box flexDirection="column">
          <TextPrompt
            label="Your email"
            value={identEmail}
            placeholder="ada@example.com"
            onChange={setIdentEmail}
            onSubmit={(v) => {
              const e = v.trim();
              if (!e || !e.includes("@")) {
                setError("Enter a valid email.");
                return;
              }
              setIdentEmail(e);
              setError(undefined);
              try {
                setLocalIdentity(identName.trim(), e);
                const msg = (pendingMessage ?? message).trim();
                runCommitWithMessage(msg);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                goStep("message");
              }
            }}
            focus
          />
          <StatusBar hints="enter save & commit · esc cancel" error={error} />
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

      {step === "remote-name" && (
        <Box flexDirection="column">
          <Text>No remote configured. Add one to push this commit.</Text>
          <TextPrompt
            label="Remote name"
            value={remoteName}
            placeholder="origin"
            onChange={setRemoteName}
            onSubmit={(v) => {
              setRemoteName(v.trim() || "origin");
              goStep("remote-url");
            }}
            focus
          />
          <StatusBar hints="enter continue · esc skip push" error={error} />
        </Box>
      )}

      {step === "remote-url" && (
        <Box flexDirection="column">
          <TextPrompt
            label={`URL for remote "${remoteName.trim() || "origin"}"`}
            value={remoteUrl}
            placeholder="git@github.com:user/repo.git"
            onChange={setRemoteUrl}
            onSubmit={(v) => {
              addRemoteAndPush(remoteName, v);
            }}
            focus
          />
          <StatusBar hints="enter add & push · esc skip push" error={error} />
        </Box>
      )}
    </Box>
  );
}
