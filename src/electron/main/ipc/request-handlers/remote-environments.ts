import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app, safeStorage } from 'electron'
import { createHowcodeRpcClientTransport } from '../../../../../server/howcode-rpc-client-transport'
import { ensureSshHowcodeEnvironmentPromise } from '../../../../../server/ssh/ssh-environment-manager'
import type { SshHowcodeEnvironmentConnection } from '../../../../../server/ssh-howcode-environments'
import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type {
  HowcodeRemoteEnvironment,
  HowcodeRemoteEnvironmentInput,
  HowcodeServerConnectionState,
} from '../../../../../shared/howcode-server-contracts'
import {
  assertCompatibleHowcodeServerDescriptor,
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  type HowcodeServerDescriptor,
} from '../../../../../shared/howcode-server-contracts'

export type SavedRemoteEnvironmentConnectionConfig = {
  environment: HowcodeRemoteEnvironment
  baseUrl: string
  token: string
}

type RemoteEnvironmentHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listHowcodeRemoteEnvironments'
  | 'saveHowcodeRemoteEnvironment'
  | 'deleteHowcodeRemoteEnvironment'
  | 'testHowcodeRemoteEnvironment'
  | 'setActiveHowcodeRemoteEnvironment'
  | 'clearActiveHowcodeRemoteEnvironment'
  | 'getProjectRemoteEnvironmentAssignment'
  | 'setProjectRemoteEnvironmentAssignment'
>

type RemoteEnvironmentHandlerOptions = {
  setActiveRemoteEnvironment?: (
    config: SavedRemoteEnvironmentConnectionConfig,
  ) => Promise<HowcodeServerConnectionState> | HowcodeServerConnectionState
  clearActiveRemoteEnvironment?: () =>
    | Promise<HowcodeServerConnectionState>
    | HowcodeServerConnectionState
}

type PreferenceRow = { valueJson?: string }

function getDatabasePath() {
  return path.join(app.getPath('userData'), 'state', 'desktop.sqlite')
}

function getDatabase() {
  const database = new Database(getDatabasePath())
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  return database
}

type RemoteEnvironmentDatabase = ReturnType<typeof getDatabase>

function closeDatabase(database: RemoteEnvironmentDatabase) {
  ;(database as { close?: () => void }).close?.()
}

function readPreference(database: RemoteEnvironmentDatabase, key: string) {
  return database
    .prepare('SELECT value_json AS valueJson FROM app_preferences WHERE key = ?')
    .get(key) as PreferenceRow | undefined
}

function writePreference(database: RemoteEnvironmentDatabase, key: string, value: unknown) {
  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value_json)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(key, JSON.stringify(value))
}

function deletePreference(database: RemoteEnvironmentDatabase, key: string) {
  database.prepare('DELETE FROM app_preferences WHERE key = ?').run(key)
}

const remoteEnvironmentsPreferenceKey = 'remoteEnvironments'
const projectRemoteAssignmentsPreferenceKey = 'projectRemoteEnvironmentAssignments'

function readProjectRemoteAssignments(database: RemoteEnvironmentDatabase) {
  const row = readPreference(database, projectRemoteAssignmentsPreferenceKey)
  if (!row?.valueJson) return {} as Record<string, string>
  try {
    const value = JSON.parse(row.valueJson) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

function writeProjectRemoteAssignments(
  database: RemoteEnvironmentDatabase,
  assignments: Record<string, string>,
) {
  if (Object.keys(assignments).length === 0) {
    deletePreference(database, projectRemoteAssignmentsPreferenceKey)
    return
  }
  writePreference(database, projectRemoteAssignmentsPreferenceKey, assignments)
}

export function getProjectRemoteEnvironmentAssignment(projectId: string) {
  const database = getDatabase()
  try {
    return readProjectRemoteAssignments(database)[projectId] ?? null
  } finally {
    closeDatabase(database)
  }
}

function setProjectRemoteAssignment(
  database: RemoteEnvironmentDatabase,
  projectId: string,
  remoteEnvironmentId: string | null,
) {
  const assignments = readProjectRemoteAssignments(database)
  if (remoteEnvironmentId) {
    assignments[projectId] = remoteEnvironmentId
  } else {
    delete assignments[projectId]
  }
  writeProjectRemoteAssignments(database, assignments)
  return { projectId, remoteEnvironmentId }
}

function readRemoteEnvironments(database: RemoteEnvironmentDatabase) {
  const row = readPreference(database, remoteEnvironmentsPreferenceKey)
  if (!row?.valueJson) return []
  try {
    const value = JSON.parse(row.valueJson) as unknown
    return Array.isArray(value) ? (value as HowcodeRemoteEnvironment[]) : []
  } catch {
    return []
  }
}

function writeRemoteEnvironments(
  database: RemoteEnvironmentDatabase,
  environments: HowcodeRemoteEnvironment[],
) {
  if (environments.length === 0) {
    deletePreference(database, remoteEnvironmentsPreferenceKey)
    return
  }
  writePreference(database, remoteEnvironmentsPreferenceKey, environments)
}

function getTokenRef(environmentId: string) {
  return `howcode:remote-environment:${environmentId}`
}

function getCredentialPreferenceKey(tokenRef: string) {
  return `credential:${tokenRef}`
}

function encryptToken(token: string) {
  return safeStorage.isEncryptionAvailable()
    ? `safe:${safeStorage.encryptString(token).toString('base64')}`
    : `base64:${Buffer.from(token, 'utf8').toString('base64')}`
}

function decryptToken(value: string) {
  if (value.startsWith('safe:')) {
    return safeStorage.decryptString(Buffer.from(value.slice('safe:'.length), 'base64'))
  }
  if (value.startsWith('base64:')) {
    return Buffer.from(value.slice('base64:'.length), 'base64').toString('utf8')
  }
  return null
}

function persistToken(
  database: RemoteEnvironmentDatabase,
  tokenRef: string,
  token: string | null | undefined,
) {
  const trimmedToken = token?.trim() ?? ''
  if (!trimmedToken) return false
  writePreference(database, getCredentialPreferenceKey(tokenRef), encryptToken(trimmedToken))
  return true
}

function hasToken(database: RemoteEnvironmentDatabase, tokenRef: string) {
  return Boolean(readPreference(database, getCredentialPreferenceKey(tokenRef))?.valueJson)
}

function deleteToken(database: RemoteEnvironmentDatabase, tokenRef: string) {
  deletePreference(database, getCredentialPreferenceKey(tokenRef))
}

function readToken(database: RemoteEnvironmentDatabase, tokenRef: string) {
  const valueJson = readPreference(database, getCredentialPreferenceKey(tokenRef))?.valueJson
  if (!valueJson) return null
  try {
    const value = JSON.parse(valueJson) as unknown
    return typeof value === 'string' ? decryptToken(value) : null
  } catch {
    return decryptToken(valueJson)
  }
}

function normalizePort(value: number | null | undefined) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65_535
    ? value
    : null
}

function normalizeSshEnvironment(
  input: HowcodeRemoteEnvironmentInput,
  id: string,
): HowcodeRemoteEnvironment {
  const sshHost = input.sshHost?.trim() || null
  return {
    hasToken: Boolean(input.token?.trim()),
    id,
    kind: 'ssh',
    localPort: normalizePort(input.localPort),
    name: input.name.trim() || sshHost || 'SSH server',
    remoteCommand: input.remoteCommand?.trim() || null,
    remotePort: normalizePort(input.remotePort) ?? 39317,
    serverUrl: null,
    sshHost,
    tokenRef: getTokenRef(id),
  }
}

function isLoopbackServerUrl(serverUrl: string) {
  try {
    const url = new URL(serverUrl)
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'
  } catch {
    return false
  }
}

function normalizeDirectEnvironment(
  input: HowcodeRemoteEnvironmentInput,
  id: string,
): HowcodeRemoteEnvironment {
  const serverUrl = input.serverUrl?.trim() || null
  return {
    hasToken: Boolean(input.token?.trim()),
    id,
    kind: 'direct',
    localPort: null,
    name: input.name.trim() || serverUrl || 'Remote server',
    remoteCommand: null,
    remotePort: null,
    serverUrl,
    sshHost: null,
    tokenRef: getTokenRef(id),
  }
}

function normalizeEnvironment(input: HowcodeRemoteEnvironmentInput): HowcodeRemoteEnvironment {
  const id = input.id?.trim() || randomUUID()
  return input.kind === 'ssh'
    ? normalizeSshEnvironment(input, id)
    : normalizeDirectEnvironment(input, id)
}

export function resolveRemoteEnvironmentBaseUrl(environment: HowcodeRemoteEnvironment) {
  if (environment.kind === 'direct') return environment.serverUrl
  const localPort = normalizePort(environment.localPort)
  return localPort ? `http://127.0.0.1:${localPort}` : null
}

// TODO(server-mode): This is only an endpoint smoke check. Once remotes are attached
// to projects, make this diagnose the useful setup failures: start/ensure the SSH tunnel,
// check whether howcode serve is reachable on the remote, distinguish invalid token from
// wrong port/host, and report settings mismatches instead of just "is a server running".
async function requestRemoteInstanceManifest(baseUrl: string, token: string) {
  const transport = createHowcodeRpcClientTransport({ authToken: token, baseUrl })
  return await transport.request('getHowcodeInstanceManifest', {})
}

async function discoverRemoteEnvironmentConnection(
  environment: HowcodeRemoteEnvironment,
  token: string | null,
) {
  if (!token) return { error: 'Enter the token used by howcode serve, then save again.', ok: false }

  const cleanup: Array<() => void> = []
  const baseUrl =
    environment.kind === 'ssh'
      ? await (async () => {
          if (!environment.sshHost) throw new Error('SSH host alias is required.')
          const sshConnection: SshHowcodeEnvironmentConnection =
            await ensureSshHowcodeEnvironmentPromise({
              host: environment.sshHost,
              localPort: 0,
              remoteCommand: environment.remoteCommand ?? null,
              remotePort: environment.remotePort ?? 39317,
              token,
            })
          cleanup.push(sshConnection.close)
          return sshConnection.baseUrl
        })()
      : resolveRemoteEnvironmentBaseUrl(environment)
  if (!baseUrl) return { error: 'Missing server URL.', ok: false }

  try {
    const descriptorResponse = await fetch(new URL(HOWCODE_SERVER_DESCRIPTOR_PATH, baseUrl))
    if (!descriptorResponse.ok) {
      return { error: `Descriptor failed (${descriptorResponse.status}).`, ok: false }
    }
    assertCompatibleHowcodeServerDescriptor(
      (await descriptorResponse.json()) as HowcodeServerDescriptor,
    )

    const manifest = await requestRemoteInstanceManifest(baseUrl, token)
    return {
      error: null,
      instanceId: manifest.instanceId,
      instanceName: manifest.instanceName,
      ok: true,
      projectCount: manifest.projects.length,
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Auth failed')) {
      return { error: error.message, ok: false }
    }
    return { error: `No server at ${baseUrl}. Start howcode serve or the SSH tunnel.`, ok: false }
  } finally {
    for (const close of cleanup) close()
  }
}

export function readSavedRemoteEnvironmentConnectionConfig(
  id: string,
): SavedRemoteEnvironmentConnectionConfig | { error: string } {
  const database = getDatabase()
  try {
    return getSavedRemoteEnvironmentConnectionConfig(database, id)
  } finally {
    closeDatabase(database)
  }
}

export function readSavedRemoteEnvironmentConnectionConfigs(): SavedRemoteEnvironmentConnectionConfig[] {
  const database = getDatabase()
  try {
    return readRemoteEnvironments(database)
      .map((environment) => getSavedRemoteEnvironmentConnectionConfig(database, environment.id))
      .filter((config): config is SavedRemoteEnvironmentConnectionConfig => !('error' in config))
  } finally {
    closeDatabase(database)
  }
}

function getSavedRemoteEnvironmentConnectionConfig(
  database: RemoteEnvironmentDatabase,
  id: string,
): SavedRemoteEnvironmentConnectionConfig | { error: string } {
  const environment = readRemoteEnvironments(database).find(
    (remoteEnvironment) => remoteEnvironment.id === id,
  )
  if (!environment) return { error: 'Remote not found.' }
  const token = readToken(database, environment.tokenRef)
  if (environment.kind === 'ssh') {
    if (!token) return { error: 'Add token, save, then test.' }
    return { baseUrl: '', environment, token }
  }

  const baseUrl = resolveRemoteEnvironmentBaseUrl(environment)
  if (!baseUrl) return { error: 'Missing server URL.' }
  if (!(token || isLoopbackServerUrl(baseUrl))) {
    return { error: 'Add token, save, then test.' }
  }
  return { baseUrl, environment, token: token ?? '' }
}

export function createRemoteEnvironmentHandlers(
  options: RemoteEnvironmentHandlerOptions = {},
): RemoteEnvironmentHandlers {
  return {
    deleteHowcodeRemoteEnvironment: ({ id }) => {
      const database = getDatabase()
      try {
        const currentEnvironment = readRemoteEnvironments(database).find(
          (remoteEnvironment) => remoteEnvironment.id === id,
        )
        if (currentEnvironment) deleteToken(database, currentEnvironment.tokenRef)
        writeRemoteEnvironments(
          database,
          readRemoteEnvironments(database).filter((environment) => environment.id !== id),
        )
        return { ok: true }
      } finally {
        closeDatabase(database)
      }
    },
    listHowcodeRemoteEnvironments: () => {
      const database = getDatabase()
      try {
        return readRemoteEnvironments(database)
      } finally {
        closeDatabase(database)
      }
    },
    testHowcodeRemoteEnvironment: async ({ id }) => {
      const database = getDatabase()
      try {
        const environment = readRemoteEnvironments(database).find(
          (remoteEnvironment) => remoteEnvironment.id === id,
        )
        if (!environment) return { error: 'Remote not found.', ok: false }
        return await discoverRemoteEnvironmentConnection(
          environment,
          readToken(database, environment.tokenRef),
        )
      } finally {
        closeDatabase(database)
      }
    },
    setActiveHowcodeRemoteEnvironment: async ({ id }) => {
      if (!options.setActiveRemoteEnvironment) {
        throw new Error('Remote activation is unavailable in this runtime.')
      }
      const database = getDatabase()
      try {
        const config = getSavedRemoteEnvironmentConnectionConfig(database, id)
        if ('error' in config) throw new Error(config.error)
        return await options.setActiveRemoteEnvironment(config)
      } finally {
        closeDatabase(database)
      }
    },
    clearActiveHowcodeRemoteEnvironment: async () => {
      if (!options.clearActiveRemoteEnvironment) {
        throw new Error('Remote activation is unavailable in this runtime.')
      }
      return await options.clearActiveRemoteEnvironment()
    },
    getProjectRemoteEnvironmentAssignment: ({ projectId }) => {
      const database = getDatabase()
      try {
        return {
          projectId,
          remoteEnvironmentId: readProjectRemoteAssignments(database)[projectId] ?? null,
        }
      } finally {
        closeDatabase(database)
      }
    },
    setProjectRemoteEnvironmentAssignment: ({ projectId, remoteEnvironmentId }) => {
      const database = getDatabase()
      try {
        if (remoteEnvironmentId) {
          const remoteExists = readRemoteEnvironments(database).some(
            (environment) => environment.id === remoteEnvironmentId,
          )
          if (!remoteExists) throw new Error('Remote not found.')
        }
        return setProjectRemoteAssignment(database, projectId, remoteEnvironmentId)
      } finally {
        closeDatabase(database)
      }
    },
    saveHowcodeRemoteEnvironment: (input) => {
      const database = getDatabase()
      try {
        const nextEnvironment = normalizeEnvironment(input)
        const didPersistToken = persistToken(database, nextEnvironment.tokenRef, input.token)
        const environments = readRemoteEnvironments(database)
        const existing = environments.find((environment) => environment.id === nextEnvironment.id)
        const savedEnvironment = {
          ...nextEnvironment,
          hasToken:
            didPersistToken ||
            hasToken(database, nextEnvironment.tokenRef) ||
            existing?.hasToken === true,
        }
        writeRemoteEnvironments(database, [
          ...environments.filter((environment) => environment.id !== savedEnvironment.id),
          savedEnvironment,
        ])
        return savedEnvironment
      } finally {
        closeDatabase(database)
      }
    },
  }
}
