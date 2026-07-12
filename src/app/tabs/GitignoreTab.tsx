import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { StatusBar } from "../components/StatusBar.js";
import { TextPrompt } from "../components/TextPrompt.js";
import {
  addGitignorePattern,
  GITIGNORE_PRESETS,
  gitignoreExists,
  listGitignoreEntries,
  removeGitignoreAt,
} from "../../gitignore.js";
import {
  flattenTree,
  pathToIgnorePattern,
  type VisibleRow,
} from "../../filetree.js";

type Mode = "list" | "browse" | "type" | "presets";

type Props = {
  active: boolean;
  captureKeys: boolean;
  onInputMode?: (v: boolean) => void;
  onChanged?: () => void;
};

export function GitignoreTab({
  active,
  captureKeys,
  onInputMode,
  onChanged,
}: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [entries, setEntries] = useState(() => listGitignoreEntries());
  const [cursor, setCursor] = useState(0);
  const [presetCursor, setPresetCursor] = useState(0);
  const [pattern, setPattern] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  // browse state
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set());
  const [browseCursor, setBrowseCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const reload = useCallback(() => {
    setEntries(listGitignoreEntries());
  }, []);

  const treeRows = useMemo(
    () => (mode === "browse" ? flattenTree(openDirs) : []),
    [mode, openDirs],
  );

  useEffect(() => {
    if (active) {
      reload();
      setMode("list");
      onInputMode?.(false);
    }
  }, [active, reload, onInputMode]);

  useEffect(() => {
    setBrowseCursor((c) =>
      Math.min(c, Math.max(0, treeRows.length - 1)),
    );
  }, [treeRows.length]);

  const goMode = (m: Mode) => {
    setMode(m);
    onInputMode?.(m === "type");
    setError(undefined);
    if (m === "browse") {
      setOpenDirs(new Set());
      setBrowseCursor(0);
      setSelected(new Set());
    }
  };

  const visible = entries.filter((e) => e.kind !== "blank");
  const maxCursor = Math.max(0, visible.length - 1);

  const openFolder = (row: VisibleRow) => {
    if (!row.isDir) {
      setError("Not a folder — use space to select a file.");
      return;
    }
    setOpenDirs((prev) => {
      const next = new Set(prev);
      next.add(row.relPath);
      return next;
    });
    setError(undefined);
    setStatus(`Opened ${row.relPath}/`);
  };

  const closeFolder = (row: VisibleRow | undefined) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (row?.isDir && next.has(row.relPath)) {
        // close this folder and any nested under it
        for (const d of [...next]) {
          if (d === row.relPath || d.startsWith(row.relPath + "/")) {
            next.delete(d);
          }
        }
        setStatus(`Closed ${row.relPath}/`);
        return next;
      }
      // close parent of current row
      if (row) {
        const parent = row.relPath.includes("/")
          ? row.relPath.slice(0, row.relPath.lastIndexOf("/"))
          : row.isDir
            ? row.relPath
            : "";
        if (parent && next.has(parent)) {
          for (const d of [...next]) {
            if (d === parent || d.startsWith(parent + "/")) next.delete(d);
          }
          setStatus(`Closed ${parent}/`);
          return next;
        }
      }
      // close last opened
      if (next.size === 0) {
        setError("No open folder to close.");
        return next;
      }
      const last = [...next].sort((a, b) => b.length - a.length)[0]!;
      for (const d of [...next]) {
        if (d === last || d.startsWith(last + "/")) next.delete(d);
      }
      setStatus(`Closed ${last}/`);
      return next;
    });
    setError(undefined);
  };

  const toggleSelect = (row: VisibleRow) => {
    const pat = pathToIgnorePattern(row.relPath, row.isDir);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pat)) next.delete(pat);
      else next.add(pat);
      return next;
    });
    setError(undefined);
  };

  const commitSelection = () => {
    if (selected.size === 0) {
      setError("Select at least one file or folder (space).");
      return;
    }
    let added = 0;
    let skipped = 0;
    for (const pat of selected) {
      const r = addGitignorePattern(pat);
      if (r.ok) added++;
      else skipped++;
    }
    setStatus(
      skipped
        ? `Added ${added}, skipped ${skipped} (already present)`
        : `Added ${added} pattern(s) to .gitignore`,
    );
    setSelected(new Set());
    reload();
    onChanged?.();
    goMode("list");
  };

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;

      if (mode === "type") {
        if (key.escape) {
          setPattern("");
          goMode("list");
        }
        return;
      }

      if (mode === "browse") {
        if (key.escape || input === "b" || input === "B") {
          goMode("list");
          return;
        }
        if (key.upArrow) {
          setBrowseCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow) {
          setBrowseCursor((c) =>
            Math.min(Math.max(0, treeRows.length - 1), c + 1),
          );
          return;
        }

        const row = treeRows[browseCursor];

        if (input === "o" || input === "O") {
          if (row) openFolder(row);
          return;
        }
        if (input === "c" || input === "C") {
          closeFolder(row);
          return;
        }
        if (input === " ") {
          if (row) toggleSelect(row);
          return;
        }
        if (key.return) {
          commitSelection();
          return;
        }
        if (input === "a" || input === "A") {
          // select all visible
          setSelected((prev) => {
            const next = new Set(prev);
            for (const r of treeRows) {
              next.add(pathToIgnorePattern(r.relPath, r.isDir));
            }
            return next;
          });
          setStatus(`Selected ${treeRows.length} visible item(s)`);
          return;
        }
        return;
      }

      if (mode === "presets") {
        if (key.escape || input === "b" || input === "B") {
          goMode("list");
          return;
        }
        if (key.upArrow) {
          setPresetCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow) {
          setPresetCursor((c) =>
            Math.min(GITIGNORE_PRESETS.length - 1, c + 1),
          );
          return;
        }
        if (key.return || input === " ") {
          const pre = GITIGNORE_PRESETS[presetCursor];
          if (!pre) return;
          const r = addGitignorePattern(pre.pattern);
          if (r.ok) {
            setStatus(`Added ${pre.pattern}`);
            reload();
            onChanged?.();
            goMode("list");
          } else {
            setError(r.error);
          }
        }
        return;
      }

      // list mode
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(maxCursor, c + 1));
      } else if (input === "a" || input === "A") {
        goMode("browse");
      } else if (input === "t" || input === "T") {
        setPattern("");
        goMode("type");
      } else if (input === "p" || input === "P") {
        setPresetCursor(0);
        goMode("presets");
      } else if (input === "d" || input === "D") {
        const row = visible[cursor];
        if (!row) {
          setError("Nothing to remove.");
          return;
        }
        const r = removeGitignoreAt(row.index);
        if (r.ok) {
          setStatus(`Removed: ${row.text.trim() || "(blank)"}`);
          setError(undefined);
          reload();
          setCursor((c) =>
            Math.max(0, Math.min(c, Math.max(0, visible.length - 2))),
          );
          onChanged?.();
        } else {
          setError(r.error);
        }
      } else if (input === "r" || input === "R") {
        reload();
        setStatus("Reloaded .gitignore");
        setError(undefined);
      }
    },
    { isActive: active && captureKeys },
  );

  if (!active) return null;

  if (mode === "type") {
    return (
      <Box flexDirection="column">
        <Text bold>.gitignore · type pattern</Text>
        <Text dimColor>Custom glob · esc back to list</Text>
        <Box marginTop={1}>
          <TextPrompt
            label="Pattern"
            value={pattern}
            placeholder="*.log  or  secret/"
            onChange={setPattern}
            onSubmit={(v) => {
              const r = addGitignorePattern(v);
              if (r.ok) {
                setStatus(`Added ${v.trim()}`);
                setPattern("");
                reload();
                onChanged?.();
                goMode("list");
              } else {
                setError(r.error);
              }
            }}
            focus
          />
        </Box>
        <StatusBar hints="enter add · esc cancel" error={error} />
      </Box>
    );
  }

  if (mode === "browse") {
    const window = windowRows(treeRows, browseCursor, 16);
    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>.gitignore · pick files</Text>
          <Text dimColor>
            {" "}
            · {selected.size} selected · enter to add
          </Text>
        </Text>
        <Text dimColor>
          o open folder · c close folder · space select · a select visible
        </Text>

        <Box flexDirection="column" marginTop={1}>
          {treeRows.length === 0 ? (
            <Text dimColor>No files found.</Text>
          ) : (
            window.map(({ row, index }) => {
              const focused = index === browseCursor;
              const pat = pathToIgnorePattern(row.relPath, row.isDir);
              const checked = selected.has(pat);
              const box = checked ? "[x]" : "[ ]";
              const indent = "  ".repeat(row.depth);
              const folderMark = row.isDir
                ? row.isOpen
                  ? "▾ "
                  : "▸ "
                : "  ";
              const name = row.isDir ? `${row.name}/` : row.name;
              return (
                <Text key={row.relPath} color={focused ? "cyan" : undefined}>
                  {focused ? "❯" : " "} {box} {indent}
                  {folderMark}
                  {name}
                </Text>
              );
            })
          )}
        </Box>

        <StatusBar
          hints="↑↓ · space select · o open · c close · enter add · a all visible · esc back"
          message={status}
          error={error}
        />
      </Box>
    );
  }

  if (mode === "presets") {
    return (
      <Box flexDirection="column">
        <Text bold>.gitignore · presets</Text>
        <Text dimColor>Enter / space to add · esc back</Text>
        <Box flexDirection="column" marginTop={1}>
          {GITIGNORE_PRESETS.map((pre, i) => {
            const focused = i === presetCursor;
            return (
              <Text key={pre.pattern} color={focused ? "cyan" : undefined}>
                {focused ? "❯" : " "} {pre.label}
                <Text dimColor>  {pre.pattern}</Text>
              </Text>
            );
          })}
        </Box>
        <StatusBar hints="↑↓ · enter add · esc back" error={error} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>.gitignore</Text>
        <Text dimColor>
          {" "}
          ·{" "}
          {gitignoreExists()
            ? `${visible.length} line(s)`
            : "missing — add to create"}
        </Text>
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {visible.length === 0 ? (
          <Text dimColor>Empty — press a to pick files, p for presets.</Text>
        ) : (
          visible.map((row, i) => {
            const focused = i === cursor;
            const color =
              row.kind === "comment"
                ? "gray"
                : focused
                  ? "cyan"
                  : undefined;
            return (
              <Text
                key={`${row.index}-${row.text}`}
                color={color}
                dimColor={row.kind === "comment" && !focused}
              >
                {focused ? "❯" : " "}{" "}
                {row.kind === "comment" ? row.text : row.text.trim()}
              </Text>
            );
          })
        )}
      </Box>

      <StatusBar
        hints="↑↓ · a pick files · t type · p presets · d delete · r reload · tab · q"
        message={status}
        error={error}
      />
    </Box>
  );
}

function windowRows(
  rows: VisibleRow[],
  cursor: number,
  size: number,
): { row: VisibleRow; index: number }[] {
  if (rows.length <= size) {
    return rows.map((row, index) => ({ row, index }));
  }
  let start = Math.max(0, cursor - Math.floor(size / 2));
  if (start + size > rows.length) start = rows.length - size;
  return rows.slice(start, start + size).map((row, i) => ({
    row,
    index: start + i,
  }));
}
