const hexColorPattern = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defaultPiSettings } from '../../shared/default-pi-settings.ts'
import type { PiThemeState } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { getBundledThemes } from '../bundled-themes.ts'
import { getPiModule } from '../pi-module.ts'

const piPackagePath = path.join('node_modules', '@earendil-works', 'pi-coding-agent')

type ThemeHelpersModule = {
  getResolvedThemeColors(themeName?: string | undefined): Record<string, string>
  getThemeExportColors(themeName?: string | undefined): PiThemeState['exportColors']
  isLightTheme(themeName?: string | undefined): boolean
  loadThemeFromPath(themePath: string): unknown
  setRegisteredThemes(themes: unknown[]): void
}

type DiscoveredThemesResult = {
  themes: Array<{ name?: string | undefined; sourcePath?: string | undefined }>
  diagnostics: unknown[]
}

type LoadedBundledThemes = {
  entries: ReturnType<typeof getBundledThemes>
  themes: unknown[]
  diagnostics: PiThemeState['diagnostics']
}

let themeHelpersPromise: Promise<ThemeHelpersModule> | null = null

async function resolvePiPackageRootFromImport() {
  const entryUrl = await import.meta.resolve('@earendil-works/pi-coding-agent')
  const entryPath = fileURLToPath(entryUrl)
  return path.resolve(path.dirname(entryPath), '..')
}

function findPiPackageRoot() {
  let directory = path.dirname(fileURLToPath(import.meta.url))

  while (true) {
    const candidate = path.join(directory, piPackagePath)
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error('Could not locate @earendil-works/pi-coding-agent package root.')
    }
    directory = parent
  }
}

async function getThemeHelpers() {
  if (!themeHelpersPromise) {
    const piPackageRoot = await resolvePiPackageRootFromImport().catch(() => findPiPackageRoot())
    const themeModulePath = path.join(piPackageRoot, 'dist', 'modes/interactive/theme/theme.js')
    themeHelpersPromise = import(pathToFileURL(themeModulePath).href) as Promise<ThemeHelpersModule>
  }
  return themeHelpersPromise
}

function asDiagnostic(diagnostic: unknown): PiThemeState['diagnostics'][number] | null {
  if (!diagnostic || typeof diagnostic !== 'object') return null
  const record = diagnostic as { type?: unknown; message?: unknown; path?: unknown }
  return {
    type: typeof record.type === 'string' ? record.type : 'warning',
    message: typeof record.message === 'string' ? record.message : 'Theme issue',
    path: typeof record.path === 'string' ? record.path : undefined,
  }
}

function hexToRgb(hex: string | undefined) {
  const match = hex ? hexColorPattern.exec(hex.trim()) : null
  if (!match) return null
  return {
    r: Number.parseInt(match[1] ?? '0', 16),
    g: Number.parseInt(match[2] ?? '0', 16),
    b: Number.parseInt(match[3] ?? '0', 16),
  }
}

function luminance(hex: string | undefined) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

function isResolvedLightTheme(
  themeName: string,
  colors: Record<string, string> & { toolPendingBg?: string; userMessageBg?: string },
  exportColors: PiThemeState['exportColors'],
  isLightTheme: (themeName?: string | undefined) => boolean,
) {
  if (isLightTheme(themeName)) {
    return true
  }
  const background = exportColors.pageBg ?? colors.toolPendingBg ?? colors.userMessageBg
  return luminance(background) > 0.5
}

function getThemeEntries(
  bundledThemeEntries: ReturnType<typeof getBundledThemes>,
  themesResult: DiscoveredThemesResult,
): PiThemeState['themes'] {
  return [
    ...bundledThemeEntries,
    { name: 'dark', label: 'Pi dark', source: 'pi-builtin' as const },
    { name: 'light', label: 'Pi light', source: 'pi-builtin' as const },
    ...themesResult.themes.map((theme) => ({
      name: theme.name ?? 'unnamed',
      label: theme.name ?? 'Unnamed Pi theme',
      source: 'pi-json' as const,
      path: theme.sourcePath,
    })),
  ].filter((theme, index, themes) => themes.findIndex((item) => item.name === theme.name) === index)
}

function loadBundledThemes(loadThemeFromPath: (themePath: string) => unknown): LoadedBundledThemes {
  const entries: LoadedBundledThemes['entries'] = []
  const themes: unknown[] = []
  const diagnostics: PiThemeState['diagnostics'] = []

  for (const theme of getBundledThemes()) {
    try {
      themes.push(loadThemeFromPath(theme.path))
      entries.push(theme)
    } catch (error) {
      diagnostics.push({
        type: 'warning',
        message: `Could not load bundled theme ${theme.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        path: theme.path,
      })
    }
  }

  return { entries, themes, diagnostics }
}

export async function loadPiThemeStateInHost(
  projectPath?: string | undefined | null | undefined,
): Promise<PiThemeState> {
  const { SettingsManager, DefaultResourceLoader, getAgentDir } = await getPiModule()
  const cwd = projectPath ?? getDesktopWorkingDirectory()
  const agentDir = getAgentDir()
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
  })
  await resourceLoader.reload()

  const themesResult = resourceLoader.getThemes()
  const {
    getResolvedThemeColors,
    getThemeExportColors,
    isLightTheme,
    loadThemeFromPath,
    setRegisteredThemes,
  } = await getThemeHelpers()
  const bundled = loadBundledThemes(loadThemeFromPath)
  setRegisteredThemes([...bundled.themes, ...(themesResult.themes as unknown[])])

  const selectedTheme = settingsManager.getTheme() ?? defaultPiSettings.theme
  const themeEntries = getThemeEntries(bundled.entries, themesResult)

  try {
    const colors = getResolvedThemeColors(selectedTheme)
    const exportColors = getThemeExportColors(selectedTheme)
    return {
      selectedTheme,
      themes: themeEntries,
      colors,
      exportColors,
      isLight: isResolvedLightTheme(selectedTheme, colors, exportColors, isLightTheme),
      diagnostics: themesResult.diagnostics
        .map(asDiagnostic)
        .filter(Boolean)
        .concat(bundled.diagnostics) as PiThemeState['diagnostics'],
    }
  } catch (error) {
    const fallbackTheme = themeEntries.some((theme) => theme.name === defaultPiSettings.theme)
      ? defaultPiSettings.theme
      : 'dark'
    return {
      selectedTheme: fallbackTheme,
      themes: themeEntries,
      colors: getResolvedThemeColors(fallbackTheme),
      exportColors: getThemeExportColors(fallbackTheme),
      isLight: fallbackTheme === 'light',
      diagnostics: [
        ...themesResult.diagnostics.map(asDiagnostic).filter(Boolean),
        ...bundled.diagnostics,
        {
          type: 'warning',
          message: error instanceof Error ? error.message : String(error),
        },
      ] as PiThemeState['diagnostics'],
    }
  }
}
