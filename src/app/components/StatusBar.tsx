import { Box, Text } from "ink";

type Props = {
  hints: string;
  message?: string;
  error?: string;
};

export function StatusBar({ hints, message, error }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {error ? <Text color="red">{error}</Text> : null}
      {message && !error ? <Text color="green">{message}</Text> : null}
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
