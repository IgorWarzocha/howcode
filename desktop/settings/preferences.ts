import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as Schema from 'effect/Schema'
import { defaultShellPreferences } from '../../shared/default-shell-preferences.ts'
import type { ShellPreferences } from '../../shared/desktop-contracts.ts'
import { ShellPreferencesSchema } from '../../shared/desktop-settings-schema.ts'
import {
  readLegacyShellPreferenceScopes,
  readShellPreferencesJson,
} from '../app-settings/readers.ts'
import { writeShellPreferencesJson } from '../app-settings/writers.ts'
import { getAgentDirectory } from './paths.ts'

export type ShellPreferencesKey = keyof ShellPreferences
const decodeRecord = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))
const decodeSettings = Schema.decodeUnknownSync(ShellPreferencesSchema)
const decodeSnapshot = Schema.decodeUnknownSync(
  Schema.Struct({
    migrationVersion: Schema.Literal(1),
    global: ShellPreferencesSchema,
    directories: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  }),
)
let writes: Promise<unknown> = Promise.resolve()

async function readPiSource(directory: string, allowMissing: boolean) {
  const filePath = path.join(path.resolve(directory), 'settings.json')
  try {
    return { filePath, source: decodeRecord(JSON.parse(await readFile(filePath, 'utf8'))) }
  } catch (error) {
    if (allowMissing && error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return { filePath, source: {} }
    throw new Error(`Could not read Pi preferences at ${filePath}: ${String(error)}`, {
      cause: error,
    })
  }
}

function selectPiPreferences(
  source: Record<string, unknown> & { compaction?: unknown; images?: unknown },
) {
  const values: Partial<Record<ShellPreferencesKey, unknown>> = Object.fromEntries(
    Object.keys(defaultShellPreferences)
      .filter((key) => Object.hasOwn(source, key))
      .map((key) => [key, source[key]]),
  )
  const compaction = source.compaction
  const images = source.images
  if (compaction && typeof compaction === 'object' && 'enabled' in compaction)
    values.autoCompact = compaction.enabled
  if (images && typeof images === 'object' && 'block' in images) values.blockImages = images.block
  return values
}

function decodePiPreferences(source: Record<string, unknown>, filePath: string) {
  const values = selectPiPreferences(source)
  // Validate the entire relevant subset before changing any Howcode preference.
  try {
    decodeSettings({ ...defaultShellPreferences, ...values })
  } catch (error) {
    throw new Error(`Invalid Pi preferences at ${filePath}: ${String(error)}`, { cause: error })
  }
  return values
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation)
  writes = result.catch(() => undefined)
  return result
}

async function readOrMigrateSnapshot() {
  const stored = readShellPreferencesJson()
  const storedValue = stored === undefined ? undefined : decodeRecord(JSON.parse(stored))
  if (storedValue && Object.hasOwn(storedValue, 'migrationVersion'))
    return decodeSnapshot(storedValue)
  // The live development host persisted flat preferences before scoped migration landed.
  const savedGlobal = storedValue ? decodeSettings(storedValue) : undefined
  const { directories: knownDirectories, existingUser } = readLegacyShellPreferenceScopes()
  const directories: Record<string, Record<string, unknown>> = {}
  let global = savedGlobal ?? defaultShellPreferences
  if (existingUser) {
    // Commit the marker and all validated scopes together; a failure leaves migration retryable.
    const source = await readPiSource(getAgentDirectory(), true)
    const values = decodePiPreferences(source.source, source.filePath)
    const previousGlobal = decodeSettings({ ...defaultShellPreferences, ...values })
    global = savedGlobal ?? previousGlobal
    const sources = await Promise.all(
      knownDirectories.map(async (directory) => ({
        directory,
        local: await readPiSource(path.join(directory, '.pi'), true),
      })),
    )
    for (const { directory, local } of sources) {
      // Legacy precedence shallow-merged raw files before resolving nested aliases.
      const effective = decodeSettings({
        ...defaultShellPreferences,
        ...decodePiPreferences({ ...source.source, ...local.source }, local.filePath),
      })
      const explicit = selectPiPreferences(local.source)
      const overrides = Object.fromEntries(
        (Object.keys(effective) as ShellPreferencesKey[])
          .filter((key) => effective[key] !== previousGlobal[key] || Object.hasOwn(explicit, key))
          .map((key) => [key, effective[key]]),
      )
      if (Object.keys(overrides).length > 0) directories[path.resolve(directory)] = overrides
    }
  }
  const snapshot = decodeSnapshot({ migrationVersion: 1, global, directories })
  writeShellPreferencesJson(JSON.stringify(snapshot))
  return snapshot
}

export function loadShellPreferences(directoryPath?: string | null): Promise<ShellPreferences> {
  return serialized(async () => {
    const snapshot = await readOrMigrateSnapshot()
    return decodeSettings({
      ...snapshot.global,
      ...(directoryPath ? snapshot.directories[path.resolve(directoryPath)] : {}),
    })
  })
}

export function updateShellPreference(key: ShellPreferencesKey, value: unknown) {
  return serialized(async () => {
    const snapshot = await readOrMigrateSnapshot()
    const updated = decodeSettings({ ...snapshot.global, [key]: value })
    if (key === 'theme') {
      const { loadThemeState } = await import('./themes.ts')
      if (!(await loadThemeState(updated.theme)).themes.some((theme) => theme.name === value))
        throw new Error(`Unknown theme: ${String(value)}`)
    }
    writeShellPreferencesJson(JSON.stringify({ ...snapshot, global: updated }))
    return updated
  })
}

export function importPiPreferences(directory = getAgentDirectory()) {
  return serialized(async () => {
    const { filePath, source } = await readPiSource(directory, false)
    const values = decodePiPreferences(source, filePath)
    const snapshot = await readOrMigrateSnapshot()
    const current = snapshot.global
    const imported = decodeSettings({ ...current, ...values })
    if (Object.hasOwn(values, 'theme')) {
      const { loadThemeState } = await import('./themes.ts')
      if (
        !(await loadThemeState(imported.theme)).themes.some(
          (theme) => theme.name === imported.theme,
        )
      )
        throw new Error(`Unknown theme: ${imported.theme}. Import the theme resource separately.`)
    }
    writeShellPreferencesJson(JSON.stringify({ ...snapshot, global: imported }))
    return {
      shellPreferences: imported,
      preferenceImport: {
        sourcePath: filePath,
        importedKeys: Object.keys(values),
        changedKeys: Object.keys(values).filter(
          (key) => current[key as ShellPreferencesKey] !== imported[key as ShellPreferencesKey],
        ),
      },
    }
  })
}
