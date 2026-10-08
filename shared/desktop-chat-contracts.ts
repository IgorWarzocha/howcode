import type { Thread } from './desktop-thread-contracts'

export type ChatGroup = {
  id: string
  name: string
  orderIndex: number | null
  collapsed: boolean
  directoryId?: string | null
  threads: ChatThread[]
}

export type ChatThread = Thread & {
  groupId: string | null
  projectId: string
  // Legacy composer capabilities, not a separate product conversation class.
  isChat?: boolean
}

export type ChatSidebarState = {
  groups: ChatGroup[]
  ungroupedThreads: ChatThread[]
  selectedGroupId: string | null
}
