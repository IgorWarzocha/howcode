import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { ensureThreadStateSchema } from './schema.ts'

type DatabaseConstructor = new (filename: string, options?: { nativeBinding?: string }) => Database

function getNativeBindingPath() {
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
  const serviceNativeNodeModulesPath = process.env['HOWCODE_SERVICE_NATIVE_NODE_MODULES']?.trim()
  return serviceNativeNodeModulesPath
    ? path.join(
        serviceNativeNodeModulesPath,
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      )
    : null
}

let database: Database | null = null

function getDatabasePath() {
  const databaseDir = path.join(getDesktopUserDataPath(), 'state')
  mkdirSync(databaseDir, { recursive: true })
  return path.join(databaseDir, 'desktop.sqlite')
}

export function getThreadStateDatabase() {
  if (!database) {
    const nativeBinding = getNativeBindingPath()
    const DatabaseConstructor = Database as unknown as DatabaseConstructor
    database = nativeBinding
      ? new DatabaseConstructor(getDatabasePath(), { nativeBinding })
      : new DatabaseConstructor(getDatabasePath())
  }

  ensureThreadStateSchema(database)
  return database
}

export function closeThreadStateDatabaseForTests() {
  ;(database as { close?: () => void } | null)?.close?.()
  database = null
}
