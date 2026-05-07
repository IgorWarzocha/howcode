import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { getBundledThemes } from '../bundled-themes.ts'

const piPackagePath = path.join('node_modules', '@earendil-works', 'pi-coding-agent')

type SessionTheme = AgentSession['resourceLoader']['getThemes'] extends () => infer Result
  ? Result extends { themes: Array<infer Theme> }
    ? Theme
    : never
  : never

type PiThemeModule = {
  initTheme(themeName?: string | undefined, enableWatcher?: boolean | undefined): void
  loadThemeFromPath(themePath: string): unknown
  setRegisteredThemes(themes: SessionTheme[]): void
}

let themeModulePromise: Promise<PiThemeModule> | null = null

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

async function getPiThemeModule() {
  if (!themeModulePromise) {
    const piPackageRoot = await resolvePiPackageRootFromImport().catch(() => findPiPackageRoot())
    const themeModulePath = path.join(piPackageRoot, 'dist', 'modes/interactive/theme/theme.js')
    themeModulePromise = import(pathToFileURL(themeModulePath).href) as Promise<PiThemeModule>
  }

  return themeModulePromise
}

export async function applyHeadlessPiTheme(session: AgentSession) {
  const { initTheme, loadThemeFromPath, setRegisteredThemes } = await getPiThemeModule()
  const bundledThemes: SessionTheme[] = []
  for (const theme of getBundledThemes()) {
    try {
      bundledThemes.push(loadThemeFromPath(theme.path) as SessionTheme)
    } catch (error) {
      console.warn(
        `Could not load bundled theme ${theme.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  setRegisteredThemes([...bundledThemes, ...session.resourceLoader.getThemes().themes])
  initTheme(session.settingsManager.getTheme(), false)
}
