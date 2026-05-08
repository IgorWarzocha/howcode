import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Database from 'better-sqlite3'
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
    localPort: normalizePort(input.localPort) ?? 49317,
    name: input.name.trim() || sshHost || 'SSH server',
    remoteCommand: input.remoteCommand?.trim() || null,
    remotePort: normalizePort(input.remotePort) ?? 39317,
    serverUrl: null,
    sshHost,
    tokenRef: getTokenRef(id),
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

export function createRemoteEnvironmentHandlers(): RemoteEnvironmentHandlers {
  return {
    deleteHowcodeRemoteEnvironment: ({ id }) => {
      const database = getDatabase()
      try {
        const currentEnvironment = readRemoteEnvironments(database).find(
          (environment) => environment.id === id,
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
