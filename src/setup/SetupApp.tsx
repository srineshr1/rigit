import { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TextPrompt } from "../app/components/TextPrompt.js";
import {
  cwdDisplay,
  hasIdentity,
  initRepo,
  isGitRepo,
  setLocalIdentity,
} from "../git.js";

export type SetupNeeds = {
  needInit: boolean;
  needIdentity: boolean;
};

export function detectSetupNeeds(): SetupNeeds {
  const needInit = !isGitRepo();
  // Identity only matters once we have (or will have) a repo
  const needIdentity = !needInit && !hasIdentity();
  // If we need init, check identity after init — still prompt if missing globally
  return {
    needInit,
    needIdentity: needInit ? !hasIdentity() : needIdentity,
  };
}

type Phase =
  | "init-confirm"
  | "identity-name"
  | "identity-email"
  | "done"
  | "abort";

type Props = {
  needs: SetupNeeds;
  onReady: () => void;
};

export function SetupApp({ needs, onReady }: Props) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>(
    needs.needInit ? "init-confirm" : "identity-name",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [stillNeedIdentity, setStillNeedIdentity] = useState(
    needs.needIdentity,
  );

  const finish = () => {
    setPhase("done");
    onReady();
  };

  const afterInit = () => {
    if (stillNeedIdentity || !hasIdentity()) {
      setStillNeedIdentity(true);
      setPhase("identity-name");
    } else {
      finish();
    }
  };

  useInput((input, key) => {
    if (phase === "init-confirm") {
      if (input === "y" || input === "Y" || key.return) {
        try {
          initRepo();
          setInfo(`Initialized empty git repository in ${cwdDisplay()}`);
          afterInit();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } else if (input === "n" || input === "N" || key.escape) {
        setPhase("abort");
        exit();
      }
      return;
    }

    if (phase === "identity-name" || phase === "identity-email") {
      if (key.escape) {
        // Allow skip with warning — commit may fail later
        setInfo("Skipped identity setup. Commits may fail until you set user.name/email.");
        finish();
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text>
        <Text backgroundColor="cyan" color="black" bold>
          {" "}
          rigit setup{" "}
        </Text>
      </Text>

      {info ? (
        <Box marginTop={1}>
          <Text color="green">{info}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      {phase === "init-confirm" && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            No git repository in{" "}
            <Text color="cyan">{cwdDisplay()}</Text>
          </Text>
          <Text>
            Initialize one here?{" "}
            <Text color="cyan" bold>
              [Y]
            </Text>
            es /{" "}
            <Text color="cyan" bold>
              [N]
            </Text>
            o
          </Text>
          <Text dimColor>enter = yes · esc/n = quit</Text>
        </Box>
      )}

      {phase === "identity-name" && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Git needs your name and email for commits.</Text>
          <Text dimColor>
            Saved to this repo only (git config --local). Esc to skip.
          </Text>
          <Box marginTop={1}>
            <TextPrompt
              label="Your name"
              value={name}
              placeholder="Ada Lovelace"
              onChange={setName}
              onSubmit={(v) => {
                if (!v.trim()) {
                  setError("Name cannot be empty (or press esc to skip).");
                  return;
                }
                setError(undefined);
                setName(v.trim());
                setPhase("identity-email");
              }}
              focus
            />
          </Box>
        </Box>
      )}

      {phase === "identity-email" && (
        <Box flexDirection="column" marginTop={1}>
          <TextPrompt
            label="Your email"
            value={email}
            placeholder="ada@example.com"
            onChange={setEmail}
            onSubmit={(v) => {
              const e = v.trim();
              if (!e || !e.includes("@")) {
                setError("Enter a valid email (or press esc to skip).");
                return;
              }
              try {
                setLocalIdentity(name, e);
                setError(undefined);
                setInfo(`Identity set: ${name} <${e}>`);
                finish();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
            focus
          />
        </Box>
      )}

      {phase === "abort" && (
        <Box marginTop={1}>
          <Text dimColor>No repository created. Bye.</Text>
        </Box>
      )}
    </Box>
  );
}
