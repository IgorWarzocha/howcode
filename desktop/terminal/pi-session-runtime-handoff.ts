import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'
import { disposeWorkspaceComposerRuns } from '../pi-desktop-runtime.ts'

export async function releaseGuiRuntimeForPiSession(request: TerminalOpenRequest) {
  if (request.launchMode !== 'pi-session') return
  const sessionPath = getPersistedSessionPath(request.sessionPath)
  if (!sessionPath) return

  await disposeWorkspaceComposerRuns({
    projectPath: request.projectId,
    sessionPaths: [sessionPath],
  })
}
