import { Box, Text } from "ink";
import { StatusBar } from "../components/StatusBar.js";

type Props = {
  active: boolean;
};

export function HelpTab({ active }: Props) {
  if (!active) return null;

  return (
    <Box flexDirection="column">
      <Text bold>How rigit maps to git</Text>
      <Text> </Text>
      <Text>
        <Text color="cyan">1. File list</Text>
        <Text dimColor>  = uncommitted changes only (disk / staged)</Text>
      </Text>
      <Text>
        <Text color="yellow">2. Commit</Text>
        <Text dimColor>     = save a snapshot locally (files leave the list)</Text>
      </Text>
      <Text>
        <Text color="green">3. Push</Text>
        <Text dimColor>       = send commits to the remote (GitHub, etc.)</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>
        Git does not mark files as “pushed”. Sync ↑ means local commits not on
        the remote.
      </Text>
      <Text> </Text>
      <Text bold>File colors</Text>
      <Text>
        <Text color="green"> staged</Text>
        <Text dimColor>  in index · ready to commit</Text>
      </Text>
      <Text>
        <Text color="yellow"> modified</Text>
        <Text dimColor>  changed on disk, not staged</Text>
      </Text>
      <Text>
        <Text color="cyan"> untracked</Text>
        <Text dimColor>  new file</Text>
      </Text>
      <Text>
        <Text color="magenta"> both</Text>
        <Text dimColor>  staged + more unstaged edits</Text>
      </Text>
      <Text> </Text>
      <Text bold>Keys</Text>
      <Text dimColor> Tab / Shift+Tab  switch tabs</Text>
      <Text dimColor> ↑↓ space a enter  stage & commit flow</Text>
      <Text dimColor> c (Diff)         compare two things side-by-side</Text>
      <Text dimColor> n (Branching)    new branch</Text>
      <Text dimColor> a (Gitignore)    pick files to ignore</Text>
      <Text dimColor>   o open folder · c close · space select · enter add</Text>
      <Text dimColor> q                quit</Text>
      <Text> </Text>
      <Text bold>Cancel safety</Text>
      <Text dimColor>
        Esc after staging (before commit) unstages what rigit just staged.
      </Text>
      <StatusBar hints="tab switch · q quit" />
    </Box>
  );
}
