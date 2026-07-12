import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { StatusBar } from "../components/StatusBar.js";
import { getRecentLog, hasCommits } from "../../git.js";

type Props = {
  active: boolean;
  captureKeys: boolean;
};

export function LogTab({ active, captureKeys }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string | undefined>();

  const reload = useCallback(() => {
    setLines(getRecentLog(20));
  }, []);

  useEffect(() => {
    if (active) reload();
  }, [active, reload]);

  useInput(
    (input) => {
      if (!active || !captureKeys) return;
      if (input === "r" || input === "R") {
        reload();
        setStatus("Refreshed.");
      }
    },
    { isActive: active && captureKeys },
  );

  if (!active) return null;

  return (
    <Box flexDirection="column">
      <Text dimColor>Recent commits</Text>
      {lines.length === 0 ? (
        <Text dimColor>
          {hasCommits()
            ? "No commits to show."
            : "No commits yet — make the first one on the Commit/Push tab."}
        </Text>
      ) : (
        lines.map((line, i) => <Text key={i}>{line}</Text>)
      )}
      <StatusBar
        hints="r refresh · tab switch · q quit"
        message={status}
      />
    </Box>
  );
}
