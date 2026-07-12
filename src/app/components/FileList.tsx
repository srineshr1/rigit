import { Box, Text } from "ink";
import type { ChangedFile } from "../../git.js";
import { statusLabel } from "../../git.js";

type Props = {
  files: ChangedFile[];
  selected: Set<string>;
  cursor: number;
};

export function FileList({ files, selected, cursor }: Props) {
  const allOn =
    files.length > 0 && files.every((f) => selected.has(f.path));

  if (files.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Working tree clean — nothing to stage.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <FileRow
        focused={cursor === 0}
        checked={allOn}
        label="All files"
        hint={`${files.length}`}
      />
      {files.map((f, i) => (
        <FileRow
          key={f.path}
          focused={cursor === i + 1}
          checked={selected.has(f.path)}
          label={f.path}
          hint={statusLabel(f.status)}
        />
      ))}
    </Box>
  );
}

function FileRow({
  focused,
  checked,
  label,
  hint,
}: {
  focused: boolean;
  checked: boolean;
  label: string;
  hint?: string;
}) {
  const box = checked ? "[x]" : "[ ]";
  const prefix = focused ? "❯" : " ";
  return (
    <Box>
      <Text color={focused ? "cyan" : undefined}>
        {prefix} {box} {label}
      </Text>
      {hint ? (
        <Text dimColor>
          {"  "}
          {hint}
        </Text>
      ) : null}
    </Box>
  );
}
