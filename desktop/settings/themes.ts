import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import * as Schema from 'effect/Schema'
import type { PiThemeState } from '../../shared/desktop-contracts.ts'
import { getBundledThemes } from '../bundled-themes.ts'
import { mapWithConcurrency } from '../runtime/map-with-concurrency.ts'
import { getAgentDirectory } from './paths.ts'

const ThemeSchema = Schema.Struct({
  name: Schema.String,
  vars: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  colors: Schema.Record(Schema.String, Schema.String),
  export: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})
const decodeTheme = Schema.decodeUnknownSync(ThemeSchema)
const hexPattern = /^#[\da-f]{6}$/i

async function themeFiles(directory: string) {
  try {
    return (await readdir(directory))
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(directory, name))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

function resolveColor(
  value: string,
  variables: Record<string, string>,
  seen = new Set<string>(),
): string {
  if (hexPattern.test(value)) return value
  if (seen.has(value)) throw new Error(`Circular theme variable: ${value}`)
  const next = variables[value]
  if (next === undefined) throw new Error(`Invalid theme color: ${value}`)
  seen.add(value)
  return resolveColor(next, variables, seen)
}

async function loadPalette(filePath: string) {
  const theme = decodeTheme(JSON.parse(await readFile(filePath, 'utf8')))
  const resolve = (value: string) => resolveColor(value, theme.vars ?? {})
  const colors = Object.fromEntries(
    Object.entries(theme.colors).map(([key, value]) => [key, resolve(value)]),
  )
  const { pageBg, cardBg, infoBg } = theme.export ?? {}
  const exportColors = {
    ...(pageBg ? { pageBg: resolve(pageBg) } : {}),
    ...(cardBg ? { cardBg: resolve(cardBg) } : {}),
    ...(infoBg ? { infoBg: resolve(infoBg) } : {}),
  }
  return { name: theme.name, colors, exportColors }
}

export async function loadThemeState(
  selected: string,
  projectPath?: string | null,
): Promise<PiThemeState> {
  const bundled = getBundledThemes()
  const files = [
    ...(await themeFiles(path.join(getAgentDirectory(), 'themes'))),
    ...(projectPath ? await themeFiles(path.join(projectPath, '.pi', 'themes')) : []),
  ]
  const themes: PiThemeState['themes'] = []
  const palettes = new Map<
    string,
    { colors: Record<string, string>; exportColors: PiThemeState['exportColors'] }
  >()
  const diagnostics: PiThemeState['diagnostics'] = []
  const entries = [
    ...bundled,
    ...files.map((filePath) => ({
      name: path.basename(filePath, '.json'),
      label: path.basename(filePath, '.json'),
      path: filePath,
      source: 'pi-json' as const,
    })),
  ]
  const loaded = await mapWithConcurrency(entries, 8, async (entry) => {
    try {
      return { entry, palette: await loadPalette(entry.path) }
    } catch (error) {
      return { entry, error: error instanceof Error ? error.message : String(error) }
    }
  })
  for (const result of loaded) {
    const { entry } = result
    if (result.palette) {
      const { name, colors, exportColors } = result.palette
      palettes.set(name, { colors, exportColors })
      themes.push({ ...entry, name })
    } else {
      diagnostics.push({
        type: 'warning',
        message: result.error ?? 'Theme could not be loaded',
        path: entry.path,
      })
    }
  }
  const selectedTheme = palettes.has(selected) ? selected : 'howcode-default'
  if (selectedTheme !== selected)
    diagnostics.push({
      type: 'warning',
      message: `Theme unavailable: ${selected}. Using ${selectedTheme}.`,
    })
  const palette = palettes.get(selectedTheme)
  if (!palette) throw new Error('Bundled Howcode theme unavailable')
  const { toolPendingBg } = palette.colors
  const background = palette.exportColors.pageBg ?? toolPendingBg ?? '#000000'
  const rgb = [1, 3, 5].map(
    (offset) => Number.parseInt(background.slice(offset, offset + 2), 16) / 255,
  )
  const isLight = (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722 > 0.5
  return { selectedTheme, themes, ...palette, isLight, diagnostics }
}
