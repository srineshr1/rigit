import { Box, Text } from "ink";
import type { RepoState } from "../../git.js";

type Props = {
  state: RepoState;
};

export function RepoBanner({ state }: Props) {
  if (state.kind === "normal") return null;

  let color: "yellow" | "magenta" | "blue" | "red" = "yellow";
  let message = "";

  switch (state.kind) {
    case "empty":
      color = "blue";
      message = `No commits yet on ${state.branch}`;
      break;
    case "detached":
      color = "yellow";
      message = `Detached HEAD @ ${state.short}`;
      break;
    case "merge":
      color = "magenta";
      message = `Merge in progress — fix conflicts, then commit`;
      break;
    case "rebase":
      color = "magenta";
      message = `Rebase in progress`;
      break;
    case "cherry-pick":
      color = "magenta";
      message = `Cherry-pick in progress`;
      break;
    case "revert":
      color = "magenta";
      message = `Revert in progress`;
      break;
  }

  return (
    <Box marginBottom={1}>
      <Text color={color}>⚠ {message}</Text>
    </Box>
  );
}
