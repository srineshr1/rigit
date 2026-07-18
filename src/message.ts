import OpenAI from "openai";

/**
 * Build a simple commit message from staged name-status / paths.
 */
export function heuristicMessage(paths: string[], diffSummary: string): string {
  const names = paths.map(basename);
  if (names.length === 0) {
    return "Update files";
  }

  const kinds = parseChangeKinds(diffSummary);
  const verb = pickVerb(kinds, names);

  if (names.length === 1) {
    return `${verb} ${names[0]}`;
  }
  if (names.length === 2) {
    return `${verb} ${names[0]} and ${names[1]}`;
  }
  if (names.length <= 4) {
    const head = names.slice(0, -1).join(", ");
    return `${verb} ${head}, and ${names[names.length - 1]}`;
  }
  return `${verb} ${names.length} files`;
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}

function parseChangeKinds(summary: string): Set<string> {
  const kinds = new Set<string>();
  for (const line of summary.split("\n")) {
    const m = line.match(/^([A-Z])\t/);
    if (m?.[1]) kinds.add(m[1]);
  }
  return kinds;
}

function pickVerb(kinds: Set<string>, names: string[]): string {
  if (kinds.size === 1 && kinds.has("A")) return "Add";
  if (kinds.size === 1 && kinds.has("D")) return "Remove";
  if (kinds.size === 1 && kinds.has("R")) return "Rename";
  if (names.some((n) => /readme/i.test(n))) return "Update";
  if (
    names.some((n) => /\.(md|txt|rst)$/i.test(n)) &&
    names.every((n) => /\.(md|txt|rst)$/i.test(n))
  ) {
    return "Docs";
  }
  return "Update";
}

// ── AI providers ──────────────────────────────────────────────

export type AiProviderId = "xai" | "groq" | "gemini";

type ProviderConfig = {
  id: AiProviderId;
  label: string;
  apiKey: string;
  baseURL: string;
  /** Default model if RIGIT_AI_MODEL is unset */
  defaultModel: string;
};

const SYSTEM_PROMPT =
  "You write concise git commit messages. Reply with a single line only, no quotes, no trailing period unless needed. Prefer conventional commits style (feat:, fix:, docs:, refactor:, chore:) when it fits. Max ~72 characters.";

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/**
 * Resolve which AI provider to use.
 *
 * Priority when several keys are set:
 *   1. RIGIT_AI_PROVIDER=xai|groq|gemini (must have that key)
 *   2. XAI_API_KEY → xAI
 *   3. GROQ_API_KEY → Groq
 *   4. GEMINI_API_KEY or GOOGLE_API_KEY → Gemini
 *
 * Optional: RIGIT_AI_MODEL overrides the default model.
 */
export function resolveAiProvider(): ProviderConfig | null {
  const forced = env("RIGIT_AI_PROVIDER")?.toLowerCase() as
    | AiProviderId
    | undefined;

  const xai = env("XAI_API_KEY");
  const groq = env("GROQ_API_KEY");
  const gemini = env("GEMINI_API_KEY") ?? env("GOOGLE_API_KEY");

  const configs: ProviderConfig[] = [];
  if (xai) {
    configs.push({
      id: "xai",
      label: "xAI",
      apiKey: xai,
      baseURL: "https://api.x.ai/v1",
      defaultModel: "grok-4.5",
    });
  }
  if (groq) {
    configs.push({
      id: "groq",
      label: "Groq",
      apiKey: groq,
      baseURL: "https://api.groq.com/openai/v1",
      defaultModel: "llama-3.3-70b-versatile",
    });
  }
  if (gemini) {
    configs.push({
      id: "gemini",
      label: "Gemini",
      apiKey: gemini,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      defaultModel: "gemini-2.0-flash",
    });
  }

  if (configs.length === 0) return null;

  if (forced) {
    const match = configs.find((c) => c.id === forced);
    if (match) return match;
    // Forced provider has no key — fall through to first available
  }

  return configs[0] ?? null;
}

function cleanMessageLine(text: string): string | undefined {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.replace(/^["']|["']$/g, "").slice(0, 200);
}

async function completeWithOpenAiCompat(
  provider: ProviderConfig,
  userContent: string,
): Promise<string | undefined> {
  const model = env("RIGIT_AI_MODEL") ?? provider.defaultModel;
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    timeout: 12_000,
  });

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 80,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const text = resp.choices[0]?.message?.content?.trim();
  return text ? cleanMessageLine(text) : undefined;
}

/**
 * AI commit message when any supported key is set; otherwise heuristic.
 * Providers: xAI (XAI_API_KEY), Groq (GROQ_API_KEY), Gemini (GEMINI_API_KEY / GOOGLE_API_KEY).
 */
export async function generateCommitMessage(
  paths: string[],
  diffSummary: string,
  diffForAi: string,
): Promise<string> {
  const fallback = heuristicMessage(paths, diffSummary);
  const provider = resolveAiProvider();
  if (!provider) return fallback;

  const userContent = `Write one commit message for this staged change:\n\n${diffForAi || diffSummary || paths.join("\n")}`;

  try {
    const line = await completeWithOpenAiCompat(provider, userContent);
    return line || fallback;
  } catch {
    return fallback;
  }
}

/** For UI / debugging: which provider would be used (if any). */
export function describeAiBackend(): string {
  const p = resolveAiProvider();
  if (!p) return "heuristic (no API key)";
  const model = env("RIGIT_AI_MODEL") ?? p.defaultModel;
  return `${p.label} · ${model}`;
}
