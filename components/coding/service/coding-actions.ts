import { unhandledAction } from '../../../desktop/app-service/action-router-result.ts'
import type { DesktopAction } from '../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../shared/desktop-contracts.ts'
import type { ToolkitComponentId } from '../../../shared/toolkit-components.ts'
import { createProjectActionHandler } from './actions/project-actions.ts'
import { handleWorkspaceDesktopAction } from './actions/workspace-actions.ts'
import { createWorktreeActionHandler } from './actions/worktree-actions.ts'
import type { CodingPeers } from './dependencies.ts'

// Coding owns project and workspace actions, not core chat/settings dispatch.
export function createCodingActionHandler(peers: CodingPeers) {
  const handleProjectDesktopAction = createProjectActionHandler(peers)
  const handleWorktreeDesktopAction = createWorktreeActionHandler(peers)
  return {
    id: 'coding' satisfies ToolkitComponentId,
    async handleAction(action: DesktopAction, payload: AnyDesktopActionPayload) {
      if (
        action.startsWith('project.') ||
        action.startsWith('projects.') ||
        action === 'threads.collapse-all'
      )
        return handleProjectDesktopAction(action, payload)
      if (action.startsWith('workspace.')) {
        const result = await handleWorkspaceDesktopAction(action, payload)
        return result.handled ? result : handleWorktreeDesktopAction(action, payload)
      }
      return unhandledAction()
    },
  }
}
