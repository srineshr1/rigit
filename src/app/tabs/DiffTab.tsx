import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { StatusBar } from "../components/StatusBar.js";
import { SideBySide } from "../components/SideBySide.js";
import {
  compareLabel,
  getComparePatch,
  getDiffPatch,
  getDiffStat,
  getUntrackedPaths,
  listFileCompareChoices,
  listRefCompareChoices,
  openCompareInPager,
  openDiffInPager,
  truncateLines,
  unifiedToSideBySide,
  type CompareChoice,
  type CompareKind,
  type DiffScope,
  type SideBySideRow,
} from "../../git.js";

const SCOPES: DiffScope[] = ["unstaged", "staged", "all"];

type Mode = "browse" | "compare";

type Props = {
  active: boolean;
  captureKeys: boolean;
  selectedPaths: string[];
  allPaths: string[];
};

export function DiffTab({
  active,
  captureKeys,
  selectedPaths,
  allPaths,
}: Props) {
  const [mode, setMode] = useState<Mode>("browse");
  const [scope, setScope] = useState<DiffScope>("all");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  // compare state
  const [compareKind, setCompareKind] = useState<CompareKind>("refs");
  const [choices, setChoices] = useState<CompareChoice[]>([]);
  const [cursor, setCursor] = useState(0);
  /** Ordered picks: [left, right] — max 2 */
  const [picks, setPicks] = useState<string[]>([]);
  const [rows, setRows] = useState<SideBySideRow[]>([]);
  const [showResult, setShowResult] = useState(false);

  const paths =
    selectedPaths.length > 0
      ? selectedPaths
      : allPaths.length > 0
        ? allPaths
        : undefined;

  const reloadBrowse = useCallback(() => {
    try {
      const stat = getDiffStat(scope, paths, false);
      const patch = getDiffPatch(scope, paths, {
        color: false,
        maxChars: 8_000,
      });
      let text = "";
      if (stat) text += stat + "\n\n";
      if (patch) text += patch;

      if (scope === "unstaged" || scope === "all") {
        let untracked = getUntrackedPaths();
        if (paths?.length) {
          const set = new Set(paths);
          untracked = untracked.filter((u) => set.has(u));
        }
        if (untracked.length) {
          text +=
            (text ? "\n\n" : "") +
            "Untracked:\n" +
            untracked.map((u) => `  + ${u}`).join("\n");
        }
      }

      setBody(text.trim() || "No changes in this scope.");
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [scope, paths]);

  const loadChoices = useCallback(() => {
    if (compareKind === "refs") {
      setChoices(listRefCompareChoices(15));
    } else {
      setChoices(listFileCompareChoices([...selectedPaths, ...allPaths]));
    }
    setCursor(0);
  }, [compareKind, selectedPaths, allPaths]);

  const runCompare = useCallback(
    (left: string, right: string) => {
      try {
        const { patch, swap } = getComparePatch(compareKind, left, right, {
          maxChars: 40_000,
        });
        setRows(unifiedToSideBySide(patch, swap));
        setShowResult(true);
        setError(undefined);
        setStatus(`Comparing ${compareLabel(left)} → ${compareLabel(right)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setShowResult(false);
      }
    },
    [compareKind],
  );

  useEffect(() => {
    if (!active) return;
    if (mode === "browse") reloadBrowse();
    else loadChoices();
  }, [active, mode, reloadBrowse, loadChoices]);

  // Auto-run when two picks set
  useEffect(() => {
    if (mode === "compare" && picks.length === 2 && picks[0] && picks[1]) {
      runCompare(picks[0], picks[1]);
    } else if (picks.length < 2) {
      setShowResult(false);
      setRows([]);
    }
  }, [picks, mode, runCompare]);

  const leftPick = picks[0];
  const rightPick = picks[1];

  const togglePick = useCallback(
    (id: string) => {
      setPicks((prev) => {
        if (prev.includes(id)) {
          return prev.filter((p) => p !== id);
        }
        if (prev.length >= 2) {
          // replace right (second) pick
          return [prev[0]!, id];
        }
        return [...prev, id];
      });
      setStatus(undefined);
    },
    [],
  );

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;

      if (mode === "browse") {
        if (input === "s" || input === "S") {
          setScope((s) => {
            const i = SCOPES.indexOf(s);
            return SCOPES[(i + 1) % SCOPES.length]!;
          });
          setStatus(undefined);
        } else if (input === "c" || input === "C") {
          setMode("compare");
          setPicks([]);
          setShowResult(false);
          setStatus("Pick 2 items (space). First = left (−), second = right (+).");
        } else if (input === "p" || input === "P") {
          try {
            openDiffInPager(scope, paths);
            setStatus("Opened pager.");
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        } else if (input === "r" || input === "R" || key.return) {
          reloadBrowse();
          setStatus("Refreshed.");
        }
        return;
      }

      // compare mode
      if (key.escape || input === "b" || input === "B") {
        if (showResult && picks.length === 2) {
          // first esc hides result focus back to list? or exit compare
          setShowResult(false);
          setStatus("Selection kept — space to change picks, enter to view.");
        } else {
          setMode("browse");
          setPicks([]);
          setShowResult(false);
          setStatus(undefined);
        }
        return;
      }

      if (input === "m" || input === "M") {
        setCompareKind((k) => (k === "refs" ? "files" : "refs"));
        setPicks([]);
        setShowResult(false);
        setStatus(
          compareKind === "refs"
            ? "Compare files: pick 2 paths."
            : "Compare refs: pick 2 branches/commits.",
        );
        return;
      }

      if (input === "p" || input === "P") {
        if (leftPick && rightPick) {
          openCompareInPager(compareKind, leftPick, rightPick);
          setStatus("Opened pager.");
        } else {
          setError("Select 2 items first.");
        }
        return;
      }

      if (input === "r" || input === "R") {
        loadChoices();
        if (leftPick && rightPick) runCompare(leftPick, rightPick);
        setStatus("Refreshed.");
        return;
      }

      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(Math.max(0, choices.length - 1), c + 1));
        return;
      }

      if (input === " ") {
        const item = choices[cursor];
        if (item) togglePick(item.id);
        return;
      }

      if (input === "1") {
        const item = choices[cursor];
        if (!item) return;
        setPicks((prev) => {
          const right = prev[1] && prev[1] !== item.id ? prev[1] : prev[0] !== item.id ? prev[0] : undefined;
          return right ? [item.id, right] : [item.id];
        });
        return;
      }

      if (input === "2") {
        const item = choices[cursor];
        if (!item) return;
        setPicks((prev) => {
          const left = prev[0] && prev[0] !== item.id ? prev[0] : undefined;
          return left ? [left, item.id] : [item.id];
        });
        return;
      }

      if (key.return) {
        if (leftPick && rightPick) {
          runCompare(leftPick, rightPick);
          setShowResult(true);
        } else {
          const item = choices[cursor];
          if (item) togglePick(item.id);
        }
      }
    },
    { isActive: active && captureKeys },
  );

  const pickIndex = useMemo(() => {
    const map = new Map<string, number>();
    picks.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [picks]);

  if (!active) return null;

  function windowedChoices(
    list: CompareChoice[],
    cur: number,
    size: number,
  ): { item: CompareChoice; index: number }[] {
    if (list.length <= size) {
      return list.map((item, index) => ({ item, index }));
    }
    let start = Math.max(0, cur - Math.floor(size / 2));
    if (start + size > list.length) start = list.length - size;
    return list.slice(start, start + size).map((item, i) => ({
      item,
      index: start + i,
    }));
  }

  if (mode === "browse") {
    const pathNote =
      selectedPaths.length > 0
        ? `${selectedPaths.length} selected file(s)`
        : allPaths.length > 0
          ? "all changed files"
          : "no files";

    return (
      <Box flexDirection="column">
        <Text>
          Scope: <Text color="cyan">{scope}</Text>
          <Text dimColor>
            {" "}
            · {pathNote} · press <Text color="cyan">c</Text> to compare two things
          </Text>
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {truncateLines(body, 40)
            .split("\n")
            .map((line, i) => (
              <Text key={i}>{line || " "}</Text>
            ))}
        </Box>
        <StatusBar
          hints="c compare 2 · s scope · p pager · r refresh · tab · q"
          message={status}
          error={error}
        />
      </Box>
    );
  }

  // compare mode
  return (
    <Box flexDirection="column">
      <Text>
        Compare{" "}
        <Text color="cyan">{compareKind === "refs" ? "refs/commits" : "files"}</Text>
        <Text dimColor> · m switch kind</Text>
      </Text>
      <Text>
        <Text color="red">− Left: </Text>
        <Text color="red" bold>
          {leftPick ? compareLabel(leftPick) : "(pick 1st)"}
        </Text>
        <Text dimColor>   </Text>
        <Text color="green">+ Right: </Text>
        <Text color="green" bold>
          {rightPick ? compareLabel(rightPick) : "(pick 2nd)"}
        </Text>
      </Text>

      {showResult && leftPick && rightPick ? (
        <Box flexDirection="column" marginTop={1}>
          <SideBySide
            leftTitle={compareLabel(leftPick)}
            rightTitle={compareLabel(rightPick)}
            rows={rows}
            maxRows={28}
          />
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Space select (max 2) · 1 set left · 2 set right · enter view
          </Text>
          {windowedChoices(choices, cursor, 16).map(({ item, index }) => {
            const focused = index === cursor;
            const ord = pickIndex.get(item.id);
            const mark = ord === 1 ? "1" : ord === 2 ? "2" : " ";
            const box = ord ? `[${mark}]` : "[ ]";
            return (
              <Box key={item.id}>
                <Text color={focused ? "cyan" : undefined}>
                  {focused ? "❯" : " "} {box} {item.label}
                </Text>
                {item.hint ? (
                  <Text dimColor>
                    {"  "}
                    {item.hint}
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}

      {/* When result showing, still allow a compact pick strip via toggling showResult off */}
      {showResult ? (
        <StatusBar
          hints="b/esc back to picks · m kind · p pager · r refresh · space on picks after back"
          message={status}
          error={error}
        />
      ) : (
        <StatusBar
          hints="space toggle · 1 left · 2 right · enter side-by-side · m refs/files · b browse · p pager"
          message={status}
          error={error}
        />
      )}
    </Box>
  );
}
