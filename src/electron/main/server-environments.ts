import type { DesktopRequestChannel, DesktopRequestMap } from '../../../shared/desktop-ipc'
import type {
  HowcodeEnvironment,
  HowcodeServerConnectionMode,
} from '../../../shared/howcode-server-contracts'

export const localDesktopEnvironment: HowcodeEnvironment = {
  id: 'local-desktop',
  kind: 'local-desktop',
  name: 'Local desktop',
  scope: 'global',
  serverUrl: null,
}

export const disabledEnvironment: HowcodeEnvironment = {
  id: 'disabled',
  kind: 'disabled',
  name: 'No Howcode server',
  scope: 'global',
  serverUrl: null,
}

export function createExternalServerEnvironment(serverUrl: string): HowcodeEnvironment {
  return {
    id: `external:${serverUrl}`,
    kind: 'external-server',
    name: serverUrl,
    scope: 'global',
    serverUrl,
  }
}

export function getConnectionModeForEnvironment(
  environment: HowcodeEnvironment,
): HowcodeServerConnectionMode {
  if (environment.kind === 'local-desktop') return 'local'
  if (environment.kind === 'external-server') return 'external'
  return 'disabled'
}

export function resolveHowcodeEnvironmentForRequest<K extends DesktopRequestChannel>(
  defaultEnvironment: HowcodeEnvironment,
  _channel: K,
  _params: DesktopRequestMap[K]['params'],
) {
  // Current server mode has one global environment. This resolver is the seam for project-scoped
  // or thread-scoped environments once those are user-configurable.
  return defaultEnvironment
}
