import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { ensureThreadStateSchema } from './schema.ts'

let database: Database | null = null

function getDatabasePath() {
  const databaseDir = path.join(getDesktopUserDataPath(), 'state')
  mkdirSync(databaseDir, { recursive: true })
  return path.join(databaseDir, 'desktop.sqlite')
}

export function getThreadStateDatabase() {
  if (!database) {
    database = new Database(getDatabasePath())
  }

  ensureThreadStateSchema(database)
  return database
}

export function closeThreadStateDatabaseForTests() {
  ;(database as { close?: () => void } | null)?.close?.()
  database = null
}
