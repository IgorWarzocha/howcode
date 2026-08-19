import type { ComposerStateRequest } from '../../../shared/desktop-contracts.ts'
import { getPersistedSessionPath } from '../../../shared/session-paths.ts'
import { buildComposerState, buildComposerStateSnapshot } from '../../runtime/composer-state.ts'
import type { PiRuntime } from '../../runtime/types.ts'
import {
  getCachedRuntimeForSessionPath,
  scheduleRuntimeDisposal,
} from '../live-runtime-registry.ts'
import { publishComposerUpdate } from '../live-thread-publisher.ts'

export async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const runtime = persistedSessionPath
    ? await getCachedRuntimeForSessionPath(persistedSessionPath)
    : null
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath })
  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  })
  return { composer, runtime }
}

export function scheduleRuntimeDisposalForRuntime(runtime: PiRuntime) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey)
}
