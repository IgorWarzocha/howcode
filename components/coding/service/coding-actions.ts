import { unhandledAction } from '../../../desktop/app-service/action-router-result.ts'
import type { DesktopAction } from '../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../shared/desktop-contracts.ts'
import type { ToolkitComponentId } from '../../../shared/toolkit-components.ts'
import { createDirectoryActionHandler } from './actions/directory-actions.ts'
import { handleWorkspaceDesktopAction } from './actions/workspace-actions.ts'
import { createWorktreeActionHandler } from './actions/worktree-actions.ts'
import type { CodingPeers } from './dependencies.ts'

// Coding owns directory and workspace actions, not core chat/settings dispatch.
export function createCodingActionHandler(peers: CodingPeers) {
  const handleDirectoryDesktopAction = createDirectoryActionHandler(peers)
  const handleWorktreeDesktopAction = createWorktreeActionHandler(peers)
  return {
    id: 'coding' satisfies ToolkitComponentId,
    async handleAction(action: DesktopAction, payload: AnyDesktopActionPayload) {
      if (
        action.startsWith('directory.') ||
        action.startsWith('projects.') ||
        action === 'chats.collapse-all'
      )
        return handleDirectoryDesktopAction(action, payload)
      if (action.startsWith('workspace.')) {
        const result = await handleWorkspaceDesktopAction(action, payload)
        return result.handled ? result : handleWorktreeDesktopAction(action, payload)
      }
      return unhandledAction()
    },
  }
}
