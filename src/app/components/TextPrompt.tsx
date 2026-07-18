import { Box, Text } from "ink";
import TextInput from "ink-text-input";

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  focus?: boolean;
  /** Mask input (for API keys / tokens) */
  mask?: boolean;
};

export function TextPrompt({
  label,
  value,
  placeholder,
  onChange,
  onSubmit,
  focus = true,
  mask = false,
}: Props) {
  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <Box>
        <Text color="cyan">{"> "}</Text>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onSubmit={onSubmit}
          focus={focus}
          showCursor
          mask={mask ? "*" : undefined}
        />
      </Box>
    </Box>
  );
}
