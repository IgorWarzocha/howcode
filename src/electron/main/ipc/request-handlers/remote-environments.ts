import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'
import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type {
  HowcodeRemoteEnvironment,
  HowcodeRemoteEnvironmentInput,
} from '../../../../../shared/howcode-server-contracts'

type RemoteEnvironmentHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listHowcodeRemoteEnvironments'
  | 'saveHowcodeRemoteEnvironment'
  | 'deleteHowcodeRemoteEnvironment'
>

type RemoteEnvironmentStore = {
  environments: HowcodeRemoteEnvironment[]
  credentials: Record<string, string>
}

function getRemoteEnvironmentStorePath() {
  return path.join(app.getPath('userData'), 'remote-environments.json')
}

function readStore(): RemoteEnvironmentStore {
  const storePath = getRemoteEnvironmentStorePath()
  if (!existsSync(storePath)) return { credentials: {}, environments: [] }
  try {
    const payload = JSON.parse(readFileSync(storePath, 'utf8')) as Partial<RemoteEnvironmentStore>
    return {
      credentials:
        typeof payload.credentials === 'object' && payload.credentials !== null
          ? payload.credentials
          : {},
      environments: Array.isArray(payload.environments) ? payload.environments : [],
    }
  } catch {
    return { credentials: {}, environments: [] }
  }
}

function writeStore(store: RemoteEnvironmentStore) {
  const storePath = getRemoteEnvironmentStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8')
}

function getTokenRef(environmentId: string) {
  return `howcode:remote-environment:${environmentId}`
}

function encryptToken(token: string) {
  return safeStorage.isEncryptionAvailable()
    ? `safe:${safeStorage.encryptString(token).toString('base64')}`
    : `base64:${Buffer.from(token, 'utf8').toString('base64')}`
}

function persistToken(
  store: RemoteEnvironmentStore,
  tokenRef: string,
  token: string | null | undefined,
) {
  const trimmedToken = token?.trim() ?? ''
  if (!trimmedToken) return false
  store.credentials[tokenRef] = encryptToken(trimmedToken)
  return true
}

function normalizePort(value: number | null | undefined) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65_535
    ? value
    : null
}

function normalizeEnvironment(input: HowcodeRemoteEnvironmentInput): HowcodeRemoteEnvironment {
  const id = input.id?.trim() || randomUUID()
  const kind = input.kind === 'ssh' ? 'ssh' : 'direct'
  return {
    hasToken: Boolean(input.token?.trim()),
    id,
    kind,
    localPort: kind === 'ssh' ? (normalizePort(input.localPort) ?? 49317) : null,
    name: input.name.trim() || (kind === 'ssh' ? (input.sshHost ?? 'SSH server') : 'Remote server'),
    remoteCommand: kind === 'ssh' ? input.remoteCommand?.trim() || null : null,
    remotePort: kind === 'ssh' ? (normalizePort(input.remotePort) ?? 39317) : null,
    serverUrl: kind === 'direct' ? input.serverUrl?.trim() || null : null,
    sshHost: kind === 'ssh' ? input.sshHost?.trim() || null : null,
    tokenRef: getTokenRef(id),
  }
}

export function createRemoteEnvironmentHandlers(): RemoteEnvironmentHandlers {
  return {
    deleteHowcodeRemoteEnvironment: ({ id }) => {
      const store = readStore()
      const currentEnvironment = store.environments.find((environment) => environment.id === id)
      if (currentEnvironment) delete store.credentials[currentEnvironment.tokenRef]
      store.environments = store.environments.filter((environment) => environment.id !== id)
      writeStore(store)
      return { ok: true }
    },
    listHowcodeRemoteEnvironments: () => readStore().environments,
    saveHowcodeRemoteEnvironment: (input) => {
      const store = readStore()
      const nextEnvironment = normalizeEnvironment(input)
      const didPersistToken = persistToken(store, nextEnvironment.tokenRef, input.token)
      const existing = store.environments.find(
        (environment) => environment.id === nextEnvironment.id,
      )
      const savedEnvironment = {
        ...nextEnvironment,
        hasToken:
          didPersistToken ||
          Boolean(store.credentials[nextEnvironment.tokenRef]) ||
          existing?.hasToken === true,
      }
      store.environments = [
        ...store.environments.filter((environment) => environment.id !== savedEnvironment.id),
        savedEnvironment,
      ]
      writeStore(store)
      return savedEnvironment
    },
  }
}
