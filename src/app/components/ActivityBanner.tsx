import { Box, Text } from "ink";
import type { SyncStatus } from "../../git.js";

export type Activity =
  | {
      type: "pushed";
      hash: string;
      remote?: string;
      branch: string;
    }
  | {
      type: "committed";
      hash: string;
      message: string;
      pushed: false;
    }
  | {
      type: "info";
      message: string;
    }
  | {
      type: "error";
      message: string;
    };

type Props = {
  activity?: Activity;
  sync: SyncStatus;
};

export function ActivityBanner({ activity, sync }: Props) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {activity ? <ActivityLine activity={activity} /> : null}
      <SyncLine sync={sync} />
    </Box>
  );
}

function ActivityLine({ activity }: { activity: Activity }) {
  if (activity.type === "pushed") {
    const dest = activity.remote ?? activity.branch;
    return (
      <Box>
        <Text backgroundColor="green" color="black" bold>
          {" "}
          PUSHED{" "}
        </Text>
        <Text color="green">
          {" "}
          Code is on the remote — {activity.hash} → {dest}
        </Text>
      </Box>
    );
  }

  if (activity.type === "committed") {
    return (
      <Box>
        <Text backgroundColor="yellow" color="black" bold>
          {" "}
          COMMITTED{" "}
        </Text>
        <Text color="yellow">
          {" "}
          Saved locally only ({activity.hash}) — not on remote yet
        </Text>
      </Box>
    );
  }

  if (activity.type === "error") {
    return (
      <Box>
        <Text backgroundColor="red" color="white" bold>
          {" "}
          ERROR{" "}
        </Text>
        <Text color="red"> {activity.message}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="cyan">ℹ {activity.message}</Text>
    </Box>
  );
}

function SyncLine({ sync }: { sync: SyncStatus }) {
  switch (sync.kind) {
    case "empty":
      return (
        <Text dimColor>
          Sync: no commits yet · file list = uncommitted changes only
        </Text>
      );
    case "no_remote":
      return (
        <Text dimColor>
          Sync: no remote · commits stay local until you add one & push
        </Text>
      );
    case "no_upstream":
      return (
        <Text color="yellow">
          Sync: {sync.branch} has no upstream · push to publish commits
        </Text>
      );
    case "synced":
      return (
        <Text color="green">
          Sync: ✓ up to date with {sync.upstream} ({sync.hash})
        </Text>
      );
    case "ahead":
      return (
        <Text color="yellow">
          Sync: ↑ {sync.ahead} local commit{sync.ahead === 1 ? "" : "s"} not
          pushed to {sync.upstream} (HEAD {sync.hash})
        </Text>
      );
    case "behind":
      return (
        <Text color="magenta">
          Sync: ↓ {sync.behind} commit{sync.behind === 1 ? "" : "s"} on{" "}
          {sync.upstream} not in local — pull before pushing
        </Text>
      );
    case "diverged":
      return (
        <Text color="red">
          Sync: diverged — ↑{sync.ahead} local / ↓{sync.behind} remote (
          {sync.upstream})
        </Text>
      );
    default:
      return null;
  }
}
