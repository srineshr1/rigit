import { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TextPrompt } from "../app/components/TextPrompt.js";
import {
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
  runGhAuthLogin,
  type GhStatus,
} from "../github.js";
import { applyConfigToEnv } from "../config.js";
import type { AiProviderId } from "../message.js";
import { describeAiBackend } from "../message.js";

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
  onExit: () => void;
};

const PROVIDERS: { id: AiProviderId | "auto"; label: string }[] = [
  { id: "auto", label: "Auto (xAI → Groq → Gemini)" },
  { id: "xai", label: "xAI (Grok)" },
  { id: "groq", label: "Groq" },
  { id: "gemini", label: "Gemini" },
];

export function ConfigSetupApp({ onExit }: Props) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<MenuId>("main");
  const [cursor, setCursor] = useState(0);
  const [config, setConfig] = useState<RigitConfig>(() => loadConfig());
  const [ghStatus, setGhStatus] = useState<GhStatus>(() => getGhAuthStatus());
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState("");
  const [inputMode, setInputMode] = useState(false);

  const refresh = () => {
    const c = loadConfig();
    setConfig(c);
    applyConfigToEnv(c);
    setGhStatus(getGhAuthStatus());
  };

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
        label: `xAI API key     ${config.xaiApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "groq",
        label: `Groq API key    ${config.groqApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "gemini",
        label: `Gemini API key  ${config.geminiApiKey ? "✓ set" : "—"}`,
      },
      {
        id: "provider",
        label: `Default provider  ${config.aiProvider ?? "auto"}`,
      },
      {
        id: "model",
        label: `Model override    ${config.aiModel ?? "(default)"}`,
      },
      {
        id: "clear-ai",
        label: "Clear all AI keys",
      },
      { id: "back", label: "← Back" },
    ],
    [config],
  );

  const githubItems = useMemo(() => {
    const ghLine = !isGhInstalled()
      ? "gh CLI            not installed"
      : ghStatus.ok && "loggedIn" in ghStatus && ghStatus.loggedIn
        ? `gh CLI            ✓ ${ghStatus.user ?? "logged in"}`
        : "gh CLI            not logged in";
    return [
      { id: "gh-status", label: ghLine },
      { id: "gh-login", label: "Run gh auth login (browser / token)" },
      {
        id: "token",
        label: `GitHub token      ${config.githubToken ? "✓ set" : "—"}`,
      },
      { id: "clear-token", label: "Clear saved GitHub token" },
      { id: "back", label: "← Back" },
    ];
  }, [config, ghStatus]);

  const providerItems = PROVIDERS;

  const listForScreen = (): { id: string; label: string }[] => {
    if (screen === "main") return mainItems;
    if (screen === "ai-menu") return aiItems;
    if (screen === "github-menu") return githubItems;
    if (screen === "set-provider")
      return providerItems.map((p) => ({ id: p.id, label: p.label }));
    if (screen === "status") return [{ id: "back", label: "← Back" }];
    return [];
  };

  const items = listForScreen();
  const maxC = Math.max(0, items.length - 1);

  const go = (s: MenuId) => {
    setScreen(s);
    setCursor(0);
    setError(undefined);
    setStatus(undefined);
    setInputMode(false);
  };

  const startSecretInput = (s: MenuId) => {
    setInputValue("");
    setScreen(s);
    setInputMode(true);
    setError(undefined);
    setStatus(undefined);
  };

  useInput(
    (input, key) => {
      if (inputMode) {
        if (key.escape) {
          go(
            screen.startsWith("set-") && screen !== "set-provider"
              ? screen.includes("gh") || screen === "set-gh-token"
                ? "github-menu"
                : "ai-menu"
              : "main",
          );
        }
        return;
      }

      if (key.escape || input === "q" || input === "Q") {
        if (screen === "main") {
          onExit();
          exit();
        } else if (
          screen === "ai-menu" ||
          screen === "github-menu" ||
          screen === "status"
        ) {
          go("main");
        } else if (screen === "set-provider") {
          go("ai-menu");
        } else {
          go("main");
        }
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
        else if (item.id === "status") go("status");
        else if (item.id === "quit") {
          onExit();
          exit();
        }
        return;
      }

      if (screen === "ai-menu") {
        if (item.id === "back") go("main");
        else if (item.id === "xai") startSecretInput("set-xai");
        else if (item.id === "groq") startSecretInput("set-groq");
        else if (item.id === "gemini") startSecretInput("set-gemini");
        else if (item.id === "provider") go("set-provider");
        else if (item.id === "model") startSecretInput("set-model");
        else if (item.id === "clear-ai") {
          let c = loadConfig();
          c = clearConfigKey("xaiApiKey");
          c = clearConfigKey("groqApiKey");
          c = clearConfigKey("geminiApiKey");
          c = clearConfigKey("aiProvider");
          c = clearConfigKey("aiModel");
          setConfig(c);
          applyConfigToEnv(c);
          setStatus("Cleared AI keys and provider preferences.");
        }
        return;
      }

      if (screen === "set-provider") {
        if (item.id === "auto") {
          const c = clearConfigKey("aiProvider");
          setConfig(c);
          applyConfigToEnv(c);
          setStatus("Provider set to auto.");
          go("ai-menu");
        } else {
          const c = saveConfig({ aiProvider: item.id as AiProviderId });
          setConfig(c);
          applyConfigToEnv(c);
          setStatus(`Provider set to ${item.id}.`);
          go("ai-menu");
        }
        return;
      }

      if (screen === "github-menu") {
        if (item.id === "back") go("main");
        else if (item.id === "gh-status") {
          refresh();
          setStatus(
            ghStatus.ok
              ? "loggedIn" in ghStatus && ghStatus.loggedIn
                ? `gh: logged in${ghStatus.user ? ` as ${ghStatus.user}` : ""}`
                : "gh: not logged in"
              : ghStatus.detail.split("\n")[0],
          );
        } else if (item.id === "gh-login") {
          // Leave TUI briefly for interactive login
          console.clear();
          const result = runGhAuthLogin();
          refresh();
          setStatus(result.detail);
          setError(result.ok ? undefined : result.detail);
        } else if (item.id === "token") {
          startSecretInput("set-gh-token");
        } else if (item.id === "clear-token") {
          const c = clearConfigKey("githubToken");
          setConfig(c);
          // Don't unset process env if user exported manually — only clear our apply
          setStatus("Cleared saved GitHub token from rigit config.");
        }
        return;
      }

      if (screen === "status" && item.id === "back") {
        go("main");
      }
    },
    { isActive: true },
  );

  const saveSecret = (field: keyof RigitConfig, value: string, label: string) => {
    const v = value.trim();
    if (!v) {
      setError("Value cannot be empty (esc to cancel).");
      return;
    }
    const c = saveConfig({ [field]: v });
    setConfig(c);
    applyConfigToEnv(c);
    setInputMode(false);
    setInputValue("");
    setStatus(`Saved ${label}.`);
    if (field === "githubToken") go("github-menu");
    else if (field === "aiModel") go("ai-menu");
    else go("ai-menu");
  };

  const title = "rigit setup";

  return (
    <Box flexDirection="column" padding={1}>
      <Text>
        <Text backgroundColor="cyan" color="black" bold>
          {" "}
          {title}{" "}
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

      {inputMode && screen === "set-xai" && (
        <SecretForm
          label="xAI API key (XAI_API_KEY)"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveSecret("xaiApiKey", v, "xAI key")}
          onCancel={() => go("ai-menu")}
        />
      )}
      {inputMode && screen === "set-groq" && (
        <SecretForm
          label="Groq API key (GROQ_API_KEY)"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveSecret("groqApiKey", v, "Groq key")}
          onCancel={() => go("ai-menu")}
        />
      )}
      {inputMode && screen === "set-gemini" && (
        <SecretForm
          label="Gemini API key (GEMINI_API_KEY)"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveSecret("geminiApiKey", v, "Gemini key")}
          onCancel={() => go("ai-menu")}
        />
      )}
      {inputMode && screen === "set-model" && (
        <SecretForm
          label="Model override (empty = provider default)"
          value={inputValue}
          onChange={setInputValue}
          mask={false}
          onSubmit={(v) => {
            const t = v.trim();
            if (!t) {
              const c = clearConfigKey("aiModel");
              setConfig(c);
              applyConfigToEnv(c);
              setStatus("Using provider default model.");
              go("ai-menu");
              return;
            }
            saveSecret("aiModel", t, "model override");
          }}
          onCancel={() => go("ai-menu")}
        />
      )}
      {inputMode && screen === "set-gh-token" && (
        <SecretForm
          label="GitHub token (GITHUB_TOKEN / GH_TOKEN)"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveSecret("githubToken", v, "GitHub token")}
          onCancel={() => go("github-menu")}
        />
      )}

      {!inputMode && screen === "status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Current configuration</Text>
          {configStatusLines(config).map((line) => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>Active AI backend: {describeAiBackend()}</Text>
          <Text dimColor>
            GitHub token in env: {hasGithubTokenInEnv() ? "yes" : "no"}
          </Text>
          {ghStatus.ok && "loggedIn" in ghStatus ? (
            <Text dimColor>
              gh CLI:{" "}
              {ghStatus.loggedIn
                ? `logged in${ghStatus.user ? ` as ${ghStatus.user}` : ""}`
                : "not logged in"}
            </Text>
          ) : (
            <Text dimColor>
              gh CLI: {isGhInstalled() ? "error" : "not installed"}
            </Text>
          )}
          <Text> </Text>
          {items.map((item, i) => (
            <Text key={item.id} color={i === cursor ? "cyan" : undefined}>
              {i === cursor ? "❯" : " "} {item.label}
            </Text>
          ))}
          <Text dimColor>enter · esc back</Text>
        </Box>
      )}

      {!inputMode && screen !== "status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            {screen === "main"
              ? "What do you want to configure?"
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
          <Text dimColor>↑↓ enter · esc / q back or quit</Text>
        </Box>
      )}
    </Box>
  );
}

function SecretForm({
  label,
  value,
  onChange,
  onSubmit,
  onCancel,
  mask = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  mask?: boolean;
}) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{label}</Text>
      <Text dimColor>Saved under ~/.config/rigit/config.json (mode 600)</Text>
      <Box marginTop={1}>
        <TextPrompt
          label={mask ? "Secret" : "Value"}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus
        />
      </Box>
      {/* TextPrompt doesn't support mask prop on our wrapper — use ink-text-input mask via optional */}
      <Text dimColor>enter save · esc cancel</Text>
    </Box>
  );
}
