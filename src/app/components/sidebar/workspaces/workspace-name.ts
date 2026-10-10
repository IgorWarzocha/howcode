import { DEFAULT_WORKSPACE_ID } from '../../../../../shared/desktop-workspace-contracts'

export function workspaceDisplayName(workspace: { id: string; name: string }) {
  return workspace.id === DEFAULT_WORKSPACE_ID && ['Chats', 'Personal'].includes(workspace.name)
    ? 'General'
    : workspace.name
}
