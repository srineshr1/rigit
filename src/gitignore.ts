import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function gitignorePath(cwd = process.cwd()): string {
  return join(cwd, ".gitignore");
}

export function gitignoreExists(cwd = process.cwd()): boolean {
  return existsSync(gitignorePath(cwd));
}

/** Non-empty lines as stored (comments kept; blank lines dropped from list index). */
export function readGitignoreLines(cwd = process.cwd()): string[] {
  const p = gitignorePath(cwd);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  // Preserve all lines including blanks for faithful rewrite
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

/** Lines useful for UI list (trim empty trailing only for display). */
export function listGitignoreEntries(cwd = process.cwd()): {
  index: number;
  text: string;
  kind: "comment" | "pattern" | "blank";
}[] {
  const lines = readGitignoreLines(cwd);
  return lines.map((text, index) => {
    const t = text.trim();
    if (!t) return { index, text, kind: "blank" as const };
    if (t.startsWith("#")) return { index, text, kind: "comment" as const };
    return { index, text, kind: "pattern" as const };
  });
}

export function writeGitignoreLines(lines: string[], cwd = process.cwd()): void {
  // Ensure file ends with newline
  const body = lines.join("\n").replace(/\n*$/, "\n");
  writeFileSync(gitignorePath(cwd), body, "utf8");
}

export function addGitignorePattern(
  pattern: string,
  cwd = process.cwd(),
): { ok: true } | { ok: false; error: string } {
  const p = pattern.trim();
  if (!p) return { ok: false, error: "Pattern cannot be empty" };
  if (p.includes("\n") || p.includes("\r")) {
    return { ok: false, error: "Pattern must be a single line" };
  }

  const lines = readGitignoreLines(cwd);
  const normalized = lines.map((l) => l.trim()).filter(Boolean);
  if (normalized.includes(p)) {
    return { ok: false, error: `Already in .gitignore: ${p}` };
  }

  // Drop trailing blanks, append pattern, one trailing newline via write
  while (lines.length && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }
  lines.push(p);
  writeGitignoreLines(lines, cwd);
  return { ok: true };
}

export function removeGitignoreAt(
  index: number,
  cwd = process.cwd(),
): { ok: true } | { ok: false; error: string } {
  const lines = readGitignoreLines(cwd);
  if (index < 0 || index >= lines.length) {
    return { ok: false, error: "Invalid line" };
  }
  lines.splice(index, 1);
  writeGitignoreLines(lines, cwd);
  return { ok: true };
}

/** Common patterns user can add quickly */
export const GITIGNORE_PRESETS: { label: string; pattern: string }[] = [
  { label: "node_modules", pattern: "node_modules/" },
  { label: "dist", pattern: "dist/" },
  { label: "build", pattern: "build/" },
  { label: ".env", pattern: ".env" },
  { label: ".env.*", pattern: ".env.*" },
  { label: "logs", pattern: "*.log" },
  { label: "OS junk", pattern: ".DS_Store" },
  { label: "coverage", pattern: "coverage/" },
  { label: ".next", pattern: ".next/" },
  { label: "target (Rust)", pattern: "target/" },
  { label: "__pycache__", pattern: "__pycache__/" },
  { label: "venv", pattern: ".venv/" },
];
