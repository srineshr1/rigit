import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { StatusBar } from "../components/StatusBar.js";
import { SideBySide } from "../components/SideBySide.js";
import {
  compareLabel,
  getComparePatch,
  listFileCompareChoices,
  listRefCompareChoices,
  openCompareInPager,
  unifiedToSideBySide,
  type CompareChoice,
  type CompareKind,
  type SideBySideRow,
} from "../../git.js";

type Props = {
  active: boolean;
  captureKeys: boolean;
  selectedPaths: string[];
  allPaths: string[];
};

/**
 * Nothing is shown (no patch) until two targets are selected.
 * Until then: pick list only.
 */
export function DiffTab({
  active,
  captureKeys,
  selectedPaths,
  allPaths,
}: Props) {
  const [compareKind, setCompareKind] = useState<CompareKind>("refs");
  const [choices, setChoices] = useState<CompareChoice[]>([]);
  const [cursor, setCursor] = useState(0);
  /** Ordered: [left, right] — max 2 */
  const [picks, setPicks] = useState<string[]>([]);
  const [rows, setRows] = useState<SideBySideRow[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  /** false = viewing diff; true = choosing (no diff body) */
  const [picking, setPicking] = useState(true);

  const leftPick = picks[0];
  const rightPick = picks[1];
  const showDiff = !picking && picks.length === 2 && !!leftPick && !!rightPick;

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
        setError(undefined);
        setStatus(`${compareLabel(left)}  →  ${compareLabel(right)}`);
        setPicking(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setRows([]);
        setPicking(true);
      }
    },
    [compareKind],
  );

  useEffect(() => {
    if (active) loadChoices();
  }, [active, loadChoices]);

  // When we have exactly 2 picks, generate and show the diff
  useEffect(() => {
    if (!active) return;
    if (picks.length === 2 && picks[0] && picks[1]) {
      runCompare(picks[0], picks[1]);
    } else {
      setRows([]);
      setPicking(true);
      setStatus(undefined);
    }
  }, [picks, compareKind, active, runCompare]);

  const togglePick = useCallback((id: string) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[0]!, id];
      return [...prev, id];
    });
    setError(undefined);
  }, []);

  useInput(
    (input, key) => {
      if (!active || !captureKeys) return;

      if (showDiff) {
        if (key.escape || input === "b" || input === "B") {
          setPicking(true);
          setStatus(undefined);
          return;
        }
        if (input === "p" || input === "P") {
          if (leftPick && rightPick) {
            openCompareInPager(compareKind, leftPick, rightPick);
            setStatus("Opened pager.");
          }
          return;
        }
        if (input === "r" || input === "R") {
          if (leftPick && rightPick) runCompare(leftPick, rightPick);
          return;
        }
        if (input === "m" || input === "M") {
          setCompareKind((k) => (k === "refs" ? "files" : "refs"));
          setPicks([]);
          setPicking(true);
          setRows([]);
          return;
        }
        return;
      }

      // pick mode
      if (input === "m" || input === "M") {
        setCompareKind((k) => (k === "refs" ? "files" : "refs"));
        setPicks([]);
        setRows([]);
        setPicking(true);
        return;
      }

      if (input === "r" || input === "R") {
        loadChoices();
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
          const right =
            prev[1] && prev[1] !== item.id
              ? prev[1]
              : prev[0] !== item.id
                ? prev[0]
                : undefined;
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
        const item = choices[cursor];
        if (item) togglePick(item.id);
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

  if (showDiff && leftPick && rightPick) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="red">− {compareLabel(leftPick)}</Text>
          <Text dimColor>  vs  </Text>
          <Text color="green">+ {compareLabel(rightPick)}</Text>
        </Text>
        <Box marginTop={1}>
          <SideBySide
            leftTitle={compareLabel(leftPick)}
            rightTitle={compareLabel(rightPick)}
            rows={rows}
            maxRows={28}
          />
        </Box>
        <StatusBar
          hints="b/esc change picks · p pager · r refresh · m refs/files · tab · q"
          message={status}
          error={error}
        />
      </Box>
    );
  }

  // Pick list only — no diff body
  return (
    <Box flexDirection="column">
      <Text>
        Select <Text color="cyan">2</Text> to compare
        <Text dimColor>
          {" "}
          · {compareKind === "refs" ? "refs/commits" : "files"} · m switch
        </Text>
      </Text>
      <Text>
        <Text color="red">− </Text>
        <Text
          color={leftPick ? "red" : undefined}
          dimColor={!leftPick}
          bold={!!leftPick}
        >
          {leftPick ? compareLabel(leftPick) : "—"}
        </Text>
        <Text dimColor>{"   "}</Text>
        <Text color="green">+ </Text>
        <Text
          color={rightPick ? "green" : undefined}
          dimColor={!rightPick}
          bold={!!rightPick}
        >
          {rightPick ? compareLabel(rightPick) : "—"}
        </Text>
        {picks.length < 2 ? (
          <Text dimColor>{`  (${2 - picks.length} more)`}</Text>
        ) : null}
      </Text>

      <Box flexDirection="column" marginTop={1}>
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

      <StatusBar
        hints="space pick (need 2) · 1 left · 2 right · m refs/files · tab · q"
        message={status}
        error={error}
      />
    </Box>
  );
}
