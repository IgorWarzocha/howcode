import type { Thread } from "./desktop-thread-contracts";

export type ChatGroup = {
  id: string;
  name: string;
  orderIndex: number | null;
  collapsed: boolean;
  threads: ChatThread[];
};

export type ChatThread = Thread & {
  groupId: string | null;
  projectId: string;
};

export type ChatSidebarState = {
  groups: ChatGroup[];
  ungroupedThreads: ChatThread[];
  selectedGroupId: string | null;
};
