import type { WorkspaceLayoutRequest } from '../shared/workspace-layout-contracts.ts'
import { databaseOperation } from './chat-repository/db.ts'
import { requestWorkspaceLayout } from './chat-repository/workspace-layout.ts'
import { emitDesktopEvent } from './runtime/desktop-events.ts'

const requestLayout = databaseOperation(requestWorkspaceLayout)

export function workspaceLayout(request: WorkspaceLayoutRequest) {
  const result = requestLayout(request)
  if (result.status === 'saved' && (request.action === 'save' || request.action === 'operate')) {
    emitDesktopEvent({
      type: 'workspace-layout-changed',
      conversationId: result.state.conversationId,
      revision: result.state.revision,
    })
  }
  return result
}
