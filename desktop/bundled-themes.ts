import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultHowcodeThemeName = 'howcode-default'

export type BundledTheme = {
  name: string
  label: string
  source: 'howcode'
  path: string
}

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function resolvePackagedThemePath(name: string) {
  const processWithResourcesPath = process as NodeJS.Process & {
    resourcesPath?: string | undefined
  }
  const resourcesPath =
    getProcessEnvironmentVariable('HOWCODE_ELECTRON_RESOURCES_PATH')?.trim() ||
    processWithResourcesPath.resourcesPath
  const packaged = resourcesPath
    ? path.join(resourcesPath, 'resources', 'themes', `${name}.json`)
    : null
  if (packaged && fs.existsSync(packaged)) {
    return packaged
  }

  const fromBuild = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'resources',
    'themes',
    `${name}.json`,
  )
  if (fs.existsSync(fromBuild)) {
    return fromBuild
  }

  return fileURLToPath(new URL(`./resources/themes/${name}.json`, import.meta.url))
}

export function getBundledThemes(): BundledTheme[] {
  return [
    {
      name: defaultHowcodeThemeName,
      label: 'Howcode default',
      source: 'howcode',
      path: resolvePackagedThemePath(defaultHowcodeThemeName),
    },
  ]
}
