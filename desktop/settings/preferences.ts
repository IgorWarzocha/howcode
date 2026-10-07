import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as Schema from 'effect/Schema'
import { defaultPiSettings } from '../../shared/default-pi-settings.ts'
import type { PiSettings } from '../../shared/desktop-contracts.ts'
import { PiSettingsSchema } from '../../shared/desktop-settings-schema.ts'
import { getAgentDirectory } from './paths.ts'

export type PiSettingsKey = keyof PiSettings
const decodeRecord = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))
const decodeSettings = Schema.decodeUnknownSync(PiSettingsSchema)
let writes: Promise<unknown> = Promise.resolve()
type SettingsFile = Record<string, unknown> & { compaction?: unknown; images?: unknown }

async function readSettingsFile(filePath: string): Promise<SettingsFile> {
  try {
    return { ...decodeRecord(JSON.parse(await readFile(filePath, 'utf8'))) }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
    throw error
  }
}

function settingsPath(projectPath?: string | null) {
  return projectPath
    ? path.join(path.resolve(projectPath), '.pi', 'settings.json')
    : path.join(getAgentDirectory(), 'settings.json')
}

export async function loadPiSettings(projectPath?: string | null): Promise<PiSettings> {
  const global = await readSettingsFile(settingsPath())
  const local = projectPath ? await readSettingsFile(settingsPath(projectPath)) : {}
  const source = { ...global, ...local }
  const result = {
    ...defaultPiSettings,
    ...Object.fromEntries(
      Object.keys(defaultPiSettings)
        .filter((key) => Object.hasOwn(source, key))
        .map((key) => [key, source[key]]),
    ),
  }
  if (source.compaction && typeof source.compaction === 'object' && 'enabled' in source.compaction)
    Object.assign(result, { autoCompact: source.compaction.enabled })
  if (source.images && typeof source.images === 'object') {
    if ('block' in source.images) Object.assign(result, { blockImages: source.images.block })
  }
  return decodeSettings(result)
}

export async function updatePiSetting(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | null,
): Promise<PiSettings> {
  const operation = writes.then(async () => {
    const updated = decodeSettings({ ...(await loadPiSettings(projectPath)), [key]: value })
    if (key === 'theme') {
      const { loadThemeState } = await import('./themes.ts')
      if (
        !(await loadThemeState(updated.theme, projectPath)).themes.some(
          (theme) => theme.name === value,
        )
      )
        throw new Error(`Unknown theme: ${String(value)}`)
    }
    const configuredPath = settingsPath(projectPath)
    // Preserve a user-managed settings symlink instead of replacing it with a regular file.
    const filePath = await realpath(configuredPath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return configuredPath
      throw error
    })
    const source = await readSettingsFile(filePath)
    source[key] = updated[key]
    // Remove the old nested alias only for the setting being written.
    if (key === 'autoCompact' && source.compaction && typeof source.compaction === 'object')
      source.compaction = { ...source.compaction, enabled: value }
    if (key === 'blockImages' && source.images && typeof source.images === 'object')
      source.images = {
        ...source.images,
        block: value,
      }
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(source, null, 2)}\n`)
    await rename(temporaryPath, filePath)
    return updated
  })
  writes = operation.catch(() => undefined)
  return operation
}
