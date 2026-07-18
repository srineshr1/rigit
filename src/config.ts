import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AiProviderId } from "./message.js";

export type RigitConfig = {
  xaiApiKey?: string;
  groqApiKey?: string;
  geminiApiKey?: string;
  /** Preferred AI provider when several keys exist */
  aiProvider?: AiProviderId;
  aiModel?: string;
  /** Personal access token (also used as GH_TOKEN / GITHUB_TOKEN) */
  githubToken?: string;
};

const CONFIG_DIR = join(homedir(), ".config", "rigit");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadConfig(): RigitConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const data = JSON.parse(raw) as RigitConfig;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveConfig( partial: Partial<RigitConfig>): RigitConfig {
  const current = loadConfig();
  const next: RigitConfig = { ...current };

  for (const [k, v] of Object.entries(partial) as [keyof RigitConfig, string | undefined][]) {
    if (v === undefined || v === "") {
      delete next[k];
    } else {
      next[k] = v;
    }
  }

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Windows may ignore chmod
  }
  return next;
}

export function clearConfigKey(key: keyof RigitConfig): RigitConfig {
  const current = loadConfig();
  delete current[key];
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(current, null, 2) + "\n", "utf8");
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* ignore */
  }
  return current;
}

/**
 * Apply saved config into process.env (does not override vars already set).
 * Call once at CLI startup.
 */
export function applyConfigToEnv(config: RigitConfig = loadConfig()): void {
  const setIfEmpty = (envKey: string, value?: string) => {
    if (!value) return;
    if (process.env[envKey]?.trim()) return;
    process.env[envKey] = value;
  };

  setIfEmpty("XAI_API_KEY", config.xaiApiKey);
  setIfEmpty("GROQ_API_KEY", config.groqApiKey);
  setIfEmpty("GEMINI_API_KEY", config.geminiApiKey);
  setIfEmpty("RIGIT_AI_PROVIDER", config.aiProvider);
  setIfEmpty("RIGIT_AI_MODEL", config.aiModel);
  setIfEmpty("GITHUB_TOKEN", config.githubToken);
  setIfEmpty("GH_TOKEN", config.githubToken);
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function configStatusLines(config: RigitConfig = loadConfig()): string[] {
  return [
    `Config file: ${CONFIG_PATH}`,
    `xAI key:     ${maskSecret(config.xaiApiKey)}`,
    `Groq key:    ${maskSecret(config.groqApiKey)}`,
    `Gemini key:  ${maskSecret(config.geminiApiKey)}`,
    `AI provider: ${config.aiProvider ?? "(auto)"}`,
    `AI model:    ${config.aiModel ?? "(provider default)"}`,
    `GitHub token:${maskSecret(config.githubToken)}`,
  ];
}
