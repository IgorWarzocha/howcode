import type { Chat } from './desktop-chat-contracts'

export const DEFAULT_WORKSPACE_ID = 'howcode:default-workspace'

export type Workspace = {
  id: string
  name: string
  orderIndex: number | null
  collapsed: boolean
  directoryId?: string | null
  chats: WorkspaceChat[]
}

export type WorkspaceChat = Chat & {
  workspaceId: string | null
  directoryId: string
  // Legacy composer capabilities, not a separate product conversation class.
  composerProfile: 'general' | 'coding'
}

export type WorkspaceNavigationState = {
  workspaces: Workspace[]
  unassignedChats: WorkspaceChat[]
  selectedWorkspaceId: string | null
}
