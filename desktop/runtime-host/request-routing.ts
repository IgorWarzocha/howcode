import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import type { RuntimeHostRequestMap, RuntimeHostRequestName } from './protocol.ts'

export function getRuntimeHostRequestSessionPath<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  if (name === 'startNewThread' || name === 'selectProjectRuntime') return null
  if (name === 'disposeRuntimeHosts') return null
  if ('request' in payload) return payload.request.sessionPath ?? null
  if ('sessionPath' in payload) return payload.sessionPath ?? null
  return null
}

export function shouldUseThreadRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  if (name === 'startNewThread' || name === 'selectProjectRuntime') return false
  if (name === 'loadThreadSnapshot') return false
  if (name === 'loadSessionTreeList') return false
  if (name === 'disposeRuntimeHosts') return false
  if (
    (name === 'getComposerSlashCommands' || name === 'getComposerSkills') &&
    !getRuntimeHostRequestSessionPath(name, payload)
  ) {
    return false
  }
  return Boolean(getPersistedSessionPath(getRuntimeHostRequestSessionPath(name, payload)))
}
