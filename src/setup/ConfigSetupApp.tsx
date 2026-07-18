import { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { TextPrompt } from "../app/components/TextPrompt.js";
import {
  applyConfigToEnv,
  clearAiConfig,
  clearConfigKey,
  getConfigPath,
  loadConfig,
  maskSecret,
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
import {
  Divider,
  FooterHints,
  MenuList,
  SetupHeader,
  StatusCard,
  Toast,
  type MenuItem,
} from "./components/SetupChrome.js";

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

const PROVIDERS: { id: AiProviderId | "auto"; label: string; hint: string }[] =
  [
    {
      id: "auto",
      label: "Auto",
      hint: "First available: xAI → Groq → Gemini",
    },
    { id: "xai", label: "xAI (Grok)", hint: "XAI_API_KEY · grok-4.5" },
    {
      id: "groq",
      label: "Groq",
      hint: "GROQ_API_KEY · llama-3.3-70b-versatile",
    },
    {
      id: "gemini",
      label: "Gemini",
      hint: "GEMINI_API_KEY · gemini-2.0-flash",
    },
  ];

function badgeSet(set: boolean): MenuItem["badge"] {
  return set
    ? { kind: "ok", label: "SET" }
    : { kind: "off", label: "EMPTY" };
}

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

  const aiReady = Boolean(
    config.xaiApiKey || config.groqApiKey || config.geminiApiKey,
  );
  const ghLoggedIn =
    isGhInstalled() &&
    ghStatus.ok &&
    "loggedIn" in ghStatus &&
    ghStatus.loggedIn;
  const ghToken = Boolean(config.githubToken) || hasGithubTokenInEnv();

  const breadcrumb =
    screen === "main"
      ? "Home"
      : screen === "ai-menu" || screen.startsWith("set-") && screen !== "set-gh-token"
        ? screen === "set-provider"
          ? "AI › Provider"
          : screen === "set-model"
            ? "AI › Model"
            : screen === "set-xai"
              ? "AI › xAI key"
              : screen === "set-groq"
                ? "AI › Groq key"
                : screen === "set-gemini"
                  ? "AI › Gemini key"
                  : "AI"
        : screen === "github-menu" || screen === "set-gh-token"
          ? screen === "set-gh-token"
            ? "GitHub › Token"
            : "GitHub"
          : screen === "status"
            ? "Status"
            : "Home";

  const mainItems: MenuItem[] = useMemo(
    () => [
      {
        id: "ai",
        label: "AI providers",
        description: "xAI · Groq · Gemini keys & defaults",
        badge: aiReady
          ? { kind: "ok", label: "READY" }
          : { kind: "warn", label: "OPTIONAL" },
      },
      {
        id: "github",
        label: "GitHub",
        description: "gh CLI login or personal access token",
        badge: ghLoggedIn || ghToken
          ? { kind: "ok", label: "READY" }
          : { kind: "warn", label: "SETUP" },
      },
      {
        id: "status",
        label: "Overview",
        description: "Masked secrets, active backend, paths",
        badge: { kind: "info", label: "VIEW" },
      },
      {
        id: "quit",
        label: "Save & exit",
        description: "Config is saved as you go",
      },
    ],
    [aiReady, ghLoggedIn, ghToken],
  );

  const aiItems: MenuItem[] = useMemo(
    () => [
      {
        id: "xai",
        label: "xAI API key",
        description: maskSecret(config.xaiApiKey),
        badge: badgeSet(!!config.xaiApiKey),
      },
      {
        id: "groq",
        label: "Groq API key",
        description: maskSecret(config.groqApiKey),
        badge: badgeSet(!!config.groqApiKey),
      },
      {
        id: "gemini",
        label: "Gemini API key",
        description: maskSecret(config.geminiApiKey),
        badge: badgeSet(!!config.geminiApiKey),
      },
      {
        id: "provider",
        label: "Default provider",
        description: config.aiProvider ?? "auto (xAI → Groq → Gemini)",
        badge: { kind: "info", label: (config.aiProvider ?? "auto").toUpperCase() },
      },
      {
        id: "model",
        label: "Model override",
        description: config.aiModel ?? "provider default",
        badge: config.aiModel
          ? { kind: "ok", label: "CUSTOM" }
          : { kind: "off", label: "DEFAULT" },
      },
      {
        id: "clear-ai",
        label: "Clear all AI keys",
        description: "Remove keys, provider, and model from config",
        danger: true,
      },
      { id: "back", label: "← Back to home" },
    ],
    [config],
  );

  const githubItems: MenuItem[] = useMemo(() => {
    let ghDesc = "Not installed — https://cli.github.com";
    let ghBadge: MenuItem["badge"] = { kind: "off", label: "MISSING" };
    if (isGhInstalled()) {
      if (ghLoggedIn) {
        ghDesc = `Signed in${ghStatus.ok && "user" in ghStatus && ghStatus.user ? ` as ${ghStatus.user}` : ""}`;
        ghBadge = { kind: "ok", label: "LIVE" };
      } else {
        ghDesc = "Installed, not logged in";
        ghBadge = { kind: "warn", label: "LOGIN" };
      }
    }
    return [
      {
        id: "gh-status",
        label: "GitHub CLI status",
        description: ghDesc,
        badge: ghBadge,
      },
      {
        id: "gh-login",
        label: "Run gh auth login",
        description: "Browser or token flow (opens outside this UI)",
        badge: { kind: "info", label: "GH" },
      },
      {
        id: "token",
        label: "Personal access token",
        description: maskSecret(config.githubToken),
        badge: badgeSet(!!config.githubToken),
      },
      {
        id: "clear-token",
        label: "Clear saved token",
        description: "Only removes token from rigit config",
        danger: true,
      },
      { id: "back", label: "← Back to home" },
    ];
  }, [config, ghStatus, ghLoggedIn]);

  const providerItems: MenuItem[] = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.hint,
    badge:
      (config.aiProvider ?? "auto") === p.id
        ? { kind: "ok", label: "ACTIVE" }
        : undefined,
  }));

  const items: MenuItem[] = (() => {
    if (screen === "main") return mainItems;
    if (screen === "ai-menu") return aiItems;
    if (screen === "github-menu") return githubItems;
    if (screen === "set-provider") return providerItems;
    if (screen === "status") return [{ id: "back", label: "← Back to home" }];
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
          setStatus("Cleared all AI keys and provider settings");
        }
        return;
      }

      if (screen === "set-provider") {
        if (item.id === "auto") {
          const c = clearConfigKey("aiProvider");
          setConfig(c);
          applyConfigToEnv(c);
          setStatus("Provider set to auto");
        } else {
          const c = saveConfig({ aiProvider: item.id as AiProviderId });
          setConfig(c);
          applyConfigToEnv(c);
          setStatus(`Provider set to ${item.id}`);
        }
        go("ai-menu");
        return;
      }

      if (screen === "github-menu") {
        if (item.id === "back") go("main");
        else if (item.id === "gh-status") {
          refreshGh();
          setStatus("Refreshed GitHub CLI status");
        } else if (item.id === "gh-login") {
          finish("gh-login");
        } else if (item.id === "token") {
          go("set-gh-token");
        } else if (item.id === "clear-token") {
          const c = clearConfigKey("githubToken");
          setConfig(c);
          setStatus("Cleared GitHub token from rigit config");
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
      setError("Cannot be empty — press esc to cancel");
      return;
    }
    const c = saveConfig({ [field]: v });
    setConfig(c);
    applyConfigToEnv(c);
    setStatus(`Saved ${label}`);
    setError(undefined);
    go(back);
  };

  const headerSubtitle =
    screen === "main"
      ? getConfigPath()
      : screen === "status"
        ? "Read-only overview · secrets are masked"
        : undefined;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <SetupHeader title={breadcrumb} subtitle={headerSubtitle} />
      <Toast status={status} error={error} />

      {/* Home dashboard strip */}
      {screen === "main" && !typing && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text dimColor>AI </Text>
            {aiReady ? (
              <Text color="green">● {describeAiBackend()}</Text>
            ) : (
              <Text color="yellow">○ heuristic only (no API key)</Text>
            )}
          </Box>
          <Box>
            <Text dimColor>GitHub </Text>
            {ghLoggedIn ? (
              <Text color="green">
                ● gh{" "}
                {ghStatus.ok && "user" in ghStatus && ghStatus.user
                  ? ghStatus.user
                  : "logged in"}
              </Text>
            ) : ghToken ? (
              <Text color="green">● token configured</Text>
            ) : (
              <Text color="yellow">○ not configured</Text>
            )}
          </Box>
          <Divider />
        </Box>
      )}

      {screen === "set-xai" && (
        <KeyForm
          title="xAI API key"
          hint="From console.x.ai · stored as XAI_API_KEY"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveField("xaiApiKey", v, "xAI key", "ai-menu")}
        />
      )}
      {screen === "set-groq" && (
        <KeyForm
          title="Groq API key"
          hint="From console.groq.com · stored as GROQ_API_KEY"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) => saveField("groqApiKey", v, "Groq key", "ai-menu")}
        />
      )}
      {screen === "set-gemini" && (
        <KeyForm
          title="Gemini API key"
          hint="From Google AI Studio · GEMINI_API_KEY"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) =>
            saveField("geminiApiKey", v, "Gemini key", "ai-menu")
          }
        />
      )}
      {screen === "set-model" && (
        <KeyForm
          title="Model override"
          hint="e.g. llama-3.1-8b-instant · esc cancel · clear via AI menu"
          value={inputValue}
          onChange={setInputValue}
          mask={false}
          onSubmit={(v) => {
            const t = v.trim();
            if (!t) {
              setError("Type a model id, or esc to cancel");
              return;
            }
            saveField("aiModel", t, "model override", "ai-menu");
          }}
        />
      )}
      {screen === "set-gh-token" && (
        <KeyForm
          title="GitHub personal access token"
          hint="classic or fine-grained · sets GITHUB_TOKEN & GH_TOKEN"
          value={inputValue}
          onChange={setInputValue}
          onSubmit={(v) =>
            saveField("githubToken", v, "GitHub token", "github-menu")
          }
        />
      )}

      {screen === "status" && (
        <Box flexDirection="column">
          <StatusCard
            title="AI"
            rows={[
              {
                label: "xAI",
                value: maskSecret(config.xaiApiKey),
                ok: !!config.xaiApiKey,
              },
              {
                label: "Groq",
                value: maskSecret(config.groqApiKey),
                ok: !!config.groqApiKey,
              },
              {
                label: "Gemini",
                value: maskSecret(config.geminiApiKey),
                ok: !!config.geminiApiKey,
              },
              {
                label: "Provider",
                value: config.aiProvider ?? "auto",
              },
              {
                label: "Model",
                value: config.aiModel ?? "(provider default)",
              },
              {
                label: "Active",
                value: describeAiBackend(),
                ok: aiReady,
              },
            ]}
          />
          <StatusCard
            title="GitHub"
            rows={[
              {
                label: "gh CLI",
                value: !isGhInstalled()
                  ? "not installed"
                  : ghLoggedIn
                    ? `logged in${ghStatus.ok && "user" in ghStatus && ghStatus.user ? ` (${ghStatus.user})` : ""}`
                    : "not logged in",
                ok: ghLoggedIn,
              },
              {
                label: "Token",
                value: maskSecret(config.githubToken),
                ok: !!config.githubToken,
              },
              {
                label: "Env token",
                value: hasGithubTokenInEnv() ? "present" : "none",
                ok: hasGithubTokenInEnv(),
              },
            ]}
          />
          <StatusCard
            title="Paths"
            rows={[{ label: "Config", value: getConfigPath() }]}
          />
          <MenuList items={items} cursor={cursor} />
          <FooterHints hints="enter select · esc back" />
        </Box>
      )}

      {!typing && screen !== "status" && (
        <Box flexDirection="column">
          {screen === "main" ? (
            <Text bold>What do you want to configure?</Text>
          ) : screen === "ai-menu" ? (
            <Text bold>AI providers</Text>
          ) : screen === "github-menu" ? (
            <Text bold>GitHub connection</Text>
          ) : screen === "set-provider" ? (
            <Text bold>Choose default provider</Text>
          ) : null}
          <Box marginTop={1}>
            <MenuList items={items} cursor={cursor} />
          </Box>
          <FooterHints hints="↑↓ move · enter select · esc / q back" />
        </Box>
      )}
    </Box>
  );
}

function KeyForm({
  title,
  hint,
  value,
  onChange,
  onSubmit,
  mask = true,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  mask?: boolean;
}) {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {title}
      </Text>
      <Text dimColor>{hint}</Text>
      <Divider />
      <Box marginY={1} flexDirection="column">
        <TextPrompt
          label={mask ? "Paste secret" : "Value"}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus
          mask={mask}
        />
      </Box>
      <Text dimColor>
        Saved to ~/.config/rigit/config.json (chmod 600) · enter save · esc
        cancel
      </Text>
    </Box>
  );
}
