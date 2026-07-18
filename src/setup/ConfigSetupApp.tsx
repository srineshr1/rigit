import { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TextPrompt } from "../app/components/TextPrompt.js";
import {
  applyConfigToEnv,
  clearAiConfig,
  clearConfigKey,
  configStatusLines,
  getConfigPath,
  loadConfig,
  saveConfig,
  type RigitConfig,
} from "../config.js";
import {
  getGhAuthStatus,
  hasGithubTokenInEnv,
  isGhInstalled,
  type GhStatus,
} from "../github.js";
import type { AiProviderId } from "../message.js";
import { describeAiBackend } from "../message.js";

export type SetupResult = "quit" | "gh-login";

type MenuId =
  | "main"
  | "ai-menu"
  | "set-xai"
  | "set-groq"
  | "set-gemini"
  | "set-provider"
  | "set-model"
  | "github-menu"
  | "set-gh-token"
  | "status";

type Props = {
  onFinish: (result: SetupResult) => void;
};

const PROVIDERS: { id: AiProviderId | "auto"; label: string }[] = [
  { id: "auto", label: "Auto (xAI → Groq → Gemini)" },
  { id: "xai", label: "xAI (Grok)" },
  { id: "groq", label: "Groq" },
  { id: "gemini", label: "Gemini" },
];

export function ConfigSetupApp({ onFinish }: Props) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<MenuId>("main");
  const [cursor, setCursor] = useState(0);
  const [config, setConfig] = useState<RigitConfig>(() => loadConfig());
  const [ghStatus, setGhStatus] = useState<GhStatus>(() => getGhAuthStatus());
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState("");

  const typing =
    screen === "set-xai" ||
    screen === "set-groq" ||
    screen === "set-gemini" ||
    screen === "set-model" ||
    screen === "set-gh-token";

  const refreshGh = () => setGhStatus(getGhAuthStatus());

  const mainItems = useMemo(
    () => [
      { id: "ai", label: "AI providers (xAI / Groq / Gemini)" },
      { id: "github", label: "GitHub (gh CLI / token)" },
      { id: "status", label: "Show current config" },
      { id: "quit", label: "Done" },
    ],
    [],
  );

  const aiItems = useMemo(
    () => [
      {
        id: "xai",
        label: `xAI API key      ${config.xaiApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "groq",
        label: `Groq API key     ${config.groqApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "gemini",
        label: `Gemini API key   ${config.geminiApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "provider",
        label: `Default provider ${config.aiProvider ?? "auto"}`,
      },
      {
        id: "model",
        label: `Model override   ${config.aiModel ?? "(default)"}`,
      },
      { id: "clear-ai", label: "Clear all AI keys" },
      { id: "back", label: "← Back" },
    ],
    [config],
  );

  const githubItems = useMemo(() => {
    let ghLine = "gh CLI            not installed";
    if (isGhInstalled()) {
      if (ghStatus.ok && "loggedIn" in ghStatus && ghStatus.loggedIn) {
        ghLine = `gh CLI            ✓ ${ghStatus.user ?? "logged in"}`;
      } else {
        ghLine = "gh CLI            not logged in";
      }
    }
    return [
      { id: "gh-status", label: ghLine },
      { id: "gh-login", label: "Run gh auth login…" },
      {
        id: "token",
        label: `GitHub token     ${config.githubToken ? "✓ set" : "—"}`,
      },
      { id: "clear-token", label: "Clear saved GitHub token" },
      { id: "back", label: "← Back" },
    ];
  }, [config, ghStatus]);

  const items = ((): { id: string; label: string }[] => {
    if (screen === "main") return mainItems;
    if (screen === "ai-menu") return aiItems;
    if (screen === "github-menu") return githubItems;
    if (screen === "set-provider") {
      return PROVIDERS.map((p) => ({ id: p.id, label: p.label }));
    }
    if (screen === "status") return [{ id: "back", label: "← Back" }];
    return [];
  })();

  const maxC = Math.max(0, items.length - 1);

  const go = (s: MenuId) => {
    setScreen(s);
    setCursor(0);
    setError(undefined);
    setInputValue("");
  };

  const finish = (result: SetupResult) => {
    onFinish(result);
    exit();
  };

  useInput(
    (input, key) => {
      if (typing) {
        if (key.escape) {
          if (screen === "set-gh-token") go("github-menu");
          else go("ai-menu");
        }
        return;
      }

      if (key.escape || input === "q" || input === "Q") {
        if (screen === "main") finish("quit");
        else if (screen === "set-provider") go("ai-menu");
        else if (
          screen === "ai-menu" ||
          screen === "github-menu" ||
          screen === "status"
        ) {
          go("main");
        } else go("main");
        return;
      }

      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(maxC, c + 1));
        return;
      }
      if (!key.return) return;

      const item = items[cursor];
      if (!item) return;

      if (screen === "main") {
        if (item.id === "ai") go("ai-menu");
        else if (item.id === "github") go("github-menu");
        else if (item.id === "status") {
          refreshGh();
          go("status");
        } else if (item.id === "quit") finish("quit");
        return;
      }

      if (screen === "ai-menu") {
        if (item.id === "back") go("main");
        else if (item.id === "xai") go("set-xai");
        else if (item.id === "groq") go("set-groq");
        else if (item.id === "gemini") go("set-gemini");
        else if (item.id === "provider") go("set-provider");
        else if (item.id === "model") go("set-model");
        else if (item.id === "clear-ai") {
          const c = clearAiConfig();
          setConfig(c);
          applyConfigToEnv(c);
          setStatus("Cleared all AI keys and provider settings.");
        }
        return;
      }

      if (screen === "set-provider") {
        if (item.id === "auto") {
          const c = clearConfigKey("aiProvider");
          setConfig(c);
          applyConfigToEnv(c);
          setStatus("Provider: auto");
        } else {
          const c = saveConfig({ aiProvider: item.id as AiProviderId });
          setConfig(c);
          applyConfigToEnv(c);
          setStatus(`Provider: ${item.id}`);
        }
        go("ai-menu");
        return;
      }

      if (screen === "github-menu") {
        if (item.id === "back") go("main");
        else if (item.id === "gh-status") {
          refreshGh();
          setStatus("Refreshed gh status.");
        } else if (item.id === "gh-login") {
          finish("gh-login");
        } else if (item.id === "token") {
          go("set-gh-token");
        } else if (item.id === "clear-token") {
          const c = clearConfigKey("githubToken");
          setConfig(c);
          setStatus("Cleared GitHub token from rigit config.");
        }
        return;
      }

      if (screen === "status" && item.id === "back") go("main");
    },
    { isActive: true },
  );

  const saveField = (
    field: keyof RigitConfig,
    value: string,
    label: string,
    back: MenuId,
  ) => {
    const v = value.trim();
    if (!v) {
      setError("Cannot be empty (esc to cancel).");
      return;
    }
    const c = saveConfig({ [field]: v });
    setConfig(c);
    applyConfigToEnv(c);
    setStatus(`Saved ${label}.`);
    setError(undefined);
    go(back);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text>
        <Text backgroundColor="cyan" color="black" bold>
          {" "}
          rigit setup{" "}
        </Text>
        <Text dimColor>  {getConfigPath()}</Text>
      </Text>

      {status ? (
        <Box marginTop={1}>
          <Text color="green">{status}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      {screen === "set-xai" && (
        <KeyForm
          label="xAI API key"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveField("xaiApiKey", v, "xAI key", "ai-menu")}
        />
      )}
      {screen === "set-groq" && (
        <KeyForm
          label="Groq API key"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveField("groqApiKey", v, "Groq key", "ai-menu")}
        />
      )}
      {screen === "set-gemini" && (
        <KeyForm
          label="Gemini API key"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) =>
            saveField("geminiApiKey", v, "Gemini key", "ai-menu")
          }
        />
      )}
      {screen === "set-model" && (
        <KeyForm
          label="Model override (enter empty via esc to clear — type name to set)"
          value={inputValue}
          onChange={setInputValue}
          mask={false}
          onSubmit={(v) => {
            const t = v.trim();
            if (!t) {
              setError("Type a model id, or esc to cancel.");
              return;
            }
            saveField("aiModel", t, "model", "ai-menu");
          }}
        />
      )}
      {screen === "set-gh-token" && (
        <KeyForm
          label="GitHub personal access token"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) =>
            saveField("githubToken", v, "GitHub token", "github-menu")
          }
        />
      )}

      {screen === "status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Current configuration</Text>
          {configStatusLines(config).map((line) => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))}
          <Text dimColor> </Text>
          <Text dimColor>Active AI: {describeAiBackend()}</Text>
          <Text dimColor>
            Token in env: {hasGithubTokenInEnv() ? "yes" : "no"}
          </Text>
          <Text dimColor>
            gh:{" "}
            {!isGhInstalled()
              ? "not installed"
              : ghStatus.ok && "loggedIn" in ghStatus && ghStatus.loggedIn
                ? `✓ ${ghStatus.user ?? "logged in"}`
                : "not logged in"}
          </Text>
          <Text> </Text>
          {items.map((item, i) => (
            <Text key={item.id} color={i === cursor ? "cyan" : undefined}>
              {i === cursor ? "❯" : " "} {item.label}
            </Text>
          ))}
          <Text dimColor>enter · esc</Text>
        </Box>
      )}

      {!typing && screen !== "status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            {screen === "main"
              ? "Configure rigit"
              : screen === "ai-menu"
                ? "AI providers"
                : screen === "github-menu"
                  ? "GitHub"
                  : screen === "set-provider"
                    ? "Default AI provider"
                    : ""}
          </Text>
          <Text> </Text>
          {items.map((item, i) => (
            <Text key={item.id} color={i === cursor ? "cyan" : undefined}>
              {i === cursor ? "❯" : " "} {item.label}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>↑↓ enter · esc / q</Text>
        </Box>
      )}
    </Box>
  );
}

function KeyForm({
  label,
  value,
  onChange,
  onSubmit,
  mask = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  mask?: boolean;
}) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{label}</Text>
      <Text dimColor>Stored in ~/.config/rigit/config.json (chmod 600)</Text>
      <Box marginTop={1}>
        <TextPrompt
          label={mask ? "Secret" : "Value"}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus
          mask={mask}
        />
      </Box>
      <Text dimColor>enter save · esc cancel</Text>
    </Box>
  );
}
