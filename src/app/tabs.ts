export const TABS = [
  { id: "commit", label: "Commit/Push" },
  { id: "branches", label: "Branching" },
  { id: "diff", label: "Diff" },
  { id: "gitignore", label: "Gitignore" },
  { id: "log", label: "Log" },
  { id: "help", label: "Help" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function nextTab(id: TabId): TabId {
  const i = TABS.findIndex((t) => t.id === id);
  return TABS[(i + 1) % TABS.length]!.id;
}

export function prevTab(id: TabId): TabId {
  const i = TABS.findIndex((t) => t.id === id);
  return TABS[(i - 1 + TABS.length) % TABS.length]!.id;
}
