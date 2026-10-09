import type {
  WorkspaceLayoutOperation,
  WorkspaceLayoutSnapshot,
} from '@howaboua/howcode-sdk/workspace-layout-state'

export type ChatWorkspaceLayout = {
  conversationId: string
  workspaceId: string | null
  revision: number
  layout: WorkspaceLayoutSnapshot
}

export type WorkspaceLayoutRequest =
  | { action: 'read'; conversationId: string }
  | {
      action: 'save'
      conversationId: string
      revision: number
      layout: WorkspaceLayoutSnapshot
    }
  | {
      action: 'operate'
      conversationId: string
      revision: number
      operation: WorkspaceLayoutOperation
    }
  | { action: 'save-default'; conversationId: string; revision: number }

export type WorkspaceLayoutResponse =
  | { status: 'saved'; state: ChatWorkspaceLayout }
  | { status: 'conflict'; state: ChatWorkspaceLayout }
