import { readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

export type TreeNode = {
  name: string;
  /** Path relative to repo root, posix-style (forward slashes) */
  relPath: string;
  isDir: boolean;
};

export type VisibleRow = TreeNode & {
  depth: number;
  isOpen: boolean;
};

const SKIP_NAMES = new Set([".git"]);

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/**
 * One directory level under repo root (or relative subdir).
 */
export function listDirLevel(
  relDir = "",
  cwd = process.cwd(),
): TreeNode[] {
  const abs = relDir ? join(cwd, relDir) : cwd;
  let names: string[];
  try {
    names = readdirSync(abs);
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];
  for (const name of names) {
    if (SKIP_NAMES.has(name)) continue;
    // hide only .git; show dotfiles so user can ignore .env etc.
    const absChild = join(abs, name);
    let isDir = false;
    try {
      isDir = statSync(absChild).isDirectory();
    } catch {
      continue;
    }
    const relPath = toPosix(
      relDir ? join(relDir, name) : name,
    );
    nodes.push({ name, relPath, isDir });
  }

  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

/**
 * Flatten tree for display: only children of open directories.
 */
export function flattenTree(
  openDirs: Set<string>,
  cwd = process.cwd(),
): VisibleRow[] {
  const rows: VisibleRow[] = [];

  const walk = (relDir: string, depth: number) => {
    for (const node of listDirLevel(relDir, cwd)) {
      const isOpen = node.isDir && openDirs.has(node.relPath);
      rows.push({ ...node, depth, isOpen });
      if (isOpen) {
        walk(node.relPath, depth + 1);
      }
    }
  };

  walk("", 0);
  return rows;
}

/** Pattern to write into .gitignore for a selected path */
export function pathToIgnorePattern(relPath: string, isDir: boolean): string {
  const p = relPath.replace(/\\/g, "/");
  if (isDir) return p.endsWith("/") ? p : `${p}/`;
  return p;
}

export function parentRel(relPath: string): string | null {
  const p = relPath.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  if (i <= 0) return i === 0 ? null : "";
  if (i < 0) return "";
  return p.slice(0, i);
}
