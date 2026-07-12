import { Box, Text, useStdout } from "ink";
import type { SideBySideRow } from "../../git.js";

type Props = {
  leftTitle: string;
  rightTitle: string;
  rows: SideBySideRow[];
  maxRows?: number;
};

function padTruncate(s: string, width: number): string {
  const flat = s.replace(/\t/g, "  ");
  if (flat.length === width) return flat;
  if (flat.length < width) return flat + " ".repeat(width - flat.length);
  if (width <= 1) return flat.slice(0, width);
  return flat.slice(0, width - 1) + "…";
}

export function SideBySide({
  leftTitle,
  rightTitle,
  rows,
  maxRows = 36,
}: Props) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns && stdout.columns > 40 ? stdout.columns : 80;
  // padding + gutter
  const usable = Math.max(40, termWidth - 6);
  const col = Math.floor((usable - 3) / 2);

  const visible = rows.slice(0, maxRows);
  const hidden = rows.length - visible.length;

  return (
    <Box flexDirection="column">
      <Box>
        <Text backgroundColor="redBright" color="black" bold>
          {" "}
          − {padTruncate(leftTitle, Math.max(1, col - 2))}{" "}
        </Text>
        <Text dimColor> │ </Text>
        <Text backgroundColor="greenBright" color="black" bold>
          {" "}
          + {padTruncate(rightTitle, Math.max(1, col - 2))}{" "}
        </Text>
      </Box>
      <Text dimColor>{"─".repeat(Math.min(termWidth - 2, col * 2 + 3))}</Text>

      {visible.map((row, i) => (
        <SideRow key={i} row={row} col={col} />
      ))}

      {hidden > 0 ? (
        <Text dimColor>…({hidden} more rows — press p for full pager)</Text>
      ) : null}
    </Box>
  );
}

function SideRow({ row, col }: { row: SideBySideRow; col: number }) {
  if (row.kind === "header" || row.kind === "meta") {
    return (
      <Text color={row.kind === "header" ? "cyan" : "gray"} dimColor={row.kind === "meta"}>
        {padTruncate(row.left || row.right, col * 2 + 3)}
      </Text>
    );
  }

  const leftColor =
    row.kind === "delete" || row.kind === "change"
      ? "red"
      : row.kind === "context"
        ? undefined
        : "gray";
  const rightColor =
    row.kind === "add" || row.kind === "change"
      ? "green"
      : row.kind === "context"
        ? undefined
        : "gray";

  const leftMark =
    row.kind === "delete" || row.kind === "change"
      ? "−"
      : row.kind === "context"
        ? " "
        : " ";
  const rightMark =
    row.kind === "add" || row.kind === "change"
      ? "+"
      : row.kind === "context"
        ? " "
        : " ";

  return (
    <Box>
      <Text color={leftColor}>
        {leftMark}
        {padTruncate(row.left, col - 1)}
      </Text>
      <Text dimColor>│</Text>
      <Text color={rightColor}>
        {rightMark}
        {padTruncate(row.right, col - 1)}
      </Text>
    </Box>
  );
}
