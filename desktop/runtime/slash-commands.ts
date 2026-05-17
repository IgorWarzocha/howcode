import type { ComposerSlashCommand, ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { discoverHeadlessAgentSessionResources } from './agent-session-extensions.ts'
import { mapSessionCommands } from './composer-slash-command-mapping.ts'
import { createComposerSnapshotSession } from './composer-state.ts'
import {
  getCachedRuntimeForSessionPath,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposalForRuntime,
} from './runtime-registry.ts'
export async function getComposerSlashCommands(
  request: ComposerStateRequest = {},
): Promise<ComposerSlashCommand[]> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const cachedRuntimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null

  if (cachedRuntimePromise && persistedSessionPath) {
    const runtime = await cachedRuntimePromise
    if (!runtime.session.isStreaming) {
      await reloadRuntimeSettingsIfSafe(persistedSessionPath)
    }
    scheduleRuntimeDisposalForRuntime(runtime)
    return mapSessionCommands(runtime.session)
  }

  const snapshot = await createComposerSnapshotSession({
    ...request,
    projectId: request.projectId ?? getDesktopWorkingDirectory(),
    sessionPath: persistedSessionPath,
  })

  try {
    await discoverHeadlessAgentSessionResources(snapshot.session).catch((error) => {
      console.warn('Pi extension resource discovery failed', error)
    })
    return mapSessionCommands(snapshot.session)
  } finally {
    snapshot.session.dispose()
  }
}
