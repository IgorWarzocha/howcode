import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { discoverHeadlessAgentSessionResources } from '../runtime/agent-session-extensions.ts'
import { createComposerSnapshotSession } from '../runtime/composer-state.ts'
import {
  getOrCreateRuntimeForSessionPath,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
} from './live-runtime-registry.ts'

type SessionResourceMapper<T> = (session: AgentSession) => T

export async function getComposerSessionResources<T>(
  request: ComposerStateRequest = {},
  mapResources: SessionResourceMapper<T>,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (persistedSessionPath) {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await reloadRuntimeSettingsIfSafe(persistedSessionPath)
    scheduleRuntimeDisposal(persistedSessionPath)
    return mapResources(runtime.session)
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
    return mapResources(snapshot.session)
  } finally {
    snapshot.session.dispose()
  }
}
