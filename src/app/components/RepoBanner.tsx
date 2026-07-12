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
      message = `No commits yet on ${state.branch} — stage files and commit to create the first one.`;
      break;
    case "detached":
      color = "yellow";
      message = `Detached HEAD at ${state.short} — commits won't move a branch until you checkout/create one.`;
      break;
    case "merge":
      color = "magenta";
      message = `Merge in progress on ${state.branch} — fix conflicts, then commit to finish.`;
      break;
    case "rebase":
      color = "magenta";
      message = `Rebase in progress — continue/abort in git, or resolve conflicts and commit.`;
      break;
    case "cherry-pick":
      color = "magenta";
      message = `Cherry-pick in progress — resolve conflicts, then commit.`;
      break;
    case "revert":
      color = "magenta";
      message = `Revert in progress — resolve conflicts, then commit.`;
      break;
  }

  return (
    <Box marginBottom={1}>
      <Text color={color}>
        ⚠ {message}
      </Text>
    </Box>
  );
}
