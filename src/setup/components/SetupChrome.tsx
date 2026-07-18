import { Box, Text } from "ink";

export function SetupHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text backgroundColor="cyan" color="black" bold>
          {" "}
          rigit{" "}
        </Text>
        <Text backgroundColor="gray" color="white">
          {" "}
          setup{" "}
        </Text>
        {title !== "Home" ? (
          <Text dimColor>
            {" "}
            › <Text color="white">{title}</Text>
          </Text>
        ) : null}
      </Box>
      {subtitle ? (
        <Text dimColor>{subtitle}</Text>
      ) : null}
    </Box>
  );
}

export function Divider({ width = 52 }: { width?: number }) {
  return <Text dimColor>{"─".repeat(width)}</Text>;
}

export function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Box flexDirection="column" marginY={0}>
      {title ? (
        <Text bold color="cyan">
          {title}
        </Text>
      ) : null}
      <Box flexDirection="column" marginTop={title ? 0 : 0}>
        {children}
      </Box>
    </Box>
  );
}

export function Badge({
  kind,
  label,
}: {
  kind: "ok" | "warn" | "off" | "info";
  label: string;
}) {
  if (kind === "ok") {
    return (
      <Text backgroundColor="green" color="black" bold>
        {" "}
        {label}{" "}
      </Text>
    );
  }
  if (kind === "warn") {
    return (
      <Text backgroundColor="yellow" color="black" bold>
        {" "}
        {label}{" "}
      </Text>
    );
  }
  if (kind === "info") {
    return (
      <Text backgroundColor="blue" color="white" bold>
        {" "}
        {label}{" "}
      </Text>
    );
  }
  return (
    <Text backgroundColor="gray" color="white">
      {" "}
      {label}{" "}
    </Text>
  );
}

export function Toast({
  status,
  error,
}: {
  status?: string;
  error?: string;
}) {
  if (!status && !error) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      {status ? (
        <Box>
          <Text backgroundColor="green" color="black" bold>
            {" "}
            OK{" "}
          </Text>
          <Text color="green"> {status}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box>
          <Text backgroundColor="red" color="white" bold>
            {" "}
            ERR{" "}
          </Text>
          <Text color="red"> {error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function FooterHints({ hints }: { hints: string }) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Divider />
      <Text dimColor>{hints}</Text>
    </Box>
  );
}

export type MenuItem = {
  id: string;
  label: string;
  description?: string;
  badge?: { kind: "ok" | "warn" | "off" | "info"; label: string };
  danger?: boolean;
};

export function MenuList({
  items,
  cursor,
}: {
  items: MenuItem[];
  cursor: number;
}) {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const focused = i === cursor;
        return (
          <Box key={item.id} flexDirection="column" marginBottom={0}>
            <Box>
              <Text
                color={focused ? (item.danger ? "red" : "cyan") : undefined}
                bold={focused}
              >
                {focused ? "❯ " : "  "}
                {item.label}
              </Text>
              {item.badge ? (
                <>
                  <Text> </Text>
                  <Badge kind={item.badge.kind} label={item.badge.label} />
                </>
              ) : null}
            </Box>
            {item.description ? (
              <Box marginLeft={4}>
                <Text dimColor>{item.description}</Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export function StatusCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; ok?: boolean }[];
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      {rows.map((r) => (
        <Box key={r.label}>
          <Text dimColor>
            {"  "}
            {r.label.padEnd(14)}
          </Text>
          <Text color={r.ok === true ? "green" : r.ok === false ? "yellow" : undefined}>
            {r.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
