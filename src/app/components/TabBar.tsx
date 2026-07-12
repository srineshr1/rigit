import { Box, Text } from "ink";
import { TABS, type TabId } from "../tabs.js";

type Props = {
  active: TabId;
};

export function TabBar({ active }: Props) {
  return (
    <Box flexDirection="row">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Box key={tab.id} marginRight={1}>
            {isActive ? (
              <Text backgroundColor="cyan" color="black" bold>
                {" "}
                {tab.label}{" "}
              </Text>
            ) : (
              <Text dimColor> {tab.label} </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
