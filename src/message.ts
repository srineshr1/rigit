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
  if (names.some((n) => /\.(md|txt|rst)$/i.test(n)) && names.every((n) => /\.(md|txt|rst)$/i.test(n))) {
    return "Docs";
  }
  return "Update";
}

/**
 * Prefer xAI when XAI_API_KEY is set; otherwise heuristic.
 */
export async function generateCommitMessage(
  paths: string[],
  diffSummary: string,
  diffForAi: string,
): Promise<string> {
  const fallback = heuristicMessage(paths, diffSummary);
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return fallback;

  try {
    const client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.x.ai/v1",
      timeout: 8_000,
    });

    const resp = await client.chat.completions.create({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content:
            "You write concise git commit messages. Reply with a single line only, no quotes, no trailing period unless needed. Prefer conventional commits style (feat:, fix:, docs:, refactor:, chore:) when it fits. Max ~72 characters.",
        },
        {
          role: "user",
          content: `Write one commit message for this staged change:\n\n${diffForAi || diffSummary || paths.join("\n")}`,
        },
      ],
    });

    const text = resp.choices[0]?.message?.content?.trim();
    if (!text) return fallback;

    // First non-empty line, strip surrounding quotes
    const line = text
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    if (!line) return fallback;
    return line.replace(/^["']|["']$/g, "").slice(0, 200);
  } catch {
    return fallback;
  }
}
