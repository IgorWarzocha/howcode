import { getPersistedSessionPath, isLocalSessionPath } from '@howcode/shared/session-paths'
import type { WorkspaceState } from '../state/workspace'

export type TakeoverTerminalIdentity = {
  key: string
  projectId: string
  threadId: string | null
  sessionPath: string | null
}

export function getLayoutThreadSelection(state: WorkspaceState) {
  const hasThreadSelection =
    state.activeView === 'chat' ||
    state.activeView === 'thread' ||
    state.activeView === 'gitops' ||
    state.activeView === 'project'
  return {
    sessionPath: hasThreadSelection ? state.selectedSessionPath : null,
    threadId: hasThreadSelection ? state.selectedThreadId : null,
  }
}

export function reconcileTakeoverTerminalIdentity(input: {
  activeView: WorkspaceState['activeView']
  current: TakeoverTerminalIdentity | null
  next: TakeoverTerminalIdentity
  takeoverPresent: boolean
  takeoverVisible: boolean
}): TakeoverTerminalIdentity | null {
  const { current, next, takeoverPresent, takeoverVisible } = input
  if (!(takeoverVisible || takeoverPresent)) return null
  if (!(takeoverVisible && current)) return takeoverVisible ? next : current
  if (current.key === next.key) return current

  const promotedCurrentDraft =
    input.activeView === 'project' &&
    current.projectId === next.projectId &&
    isLocalSessionPath(current.sessionPath) &&
    getPersistedSessionPath(next.sessionPath) !== null
  return promotedCurrentDraft ? { ...next, key: current.key } : next
}
