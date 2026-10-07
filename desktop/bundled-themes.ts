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

function resolvePackagedThemePath(name: string) {
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
    { name: 'dark', label: 'Dark', source: 'howcode', path: resolvePackagedThemePath('dark') },
    { name: 'light', label: 'Light', source: 'howcode', path: resolvePackagedThemePath('light') },
  ]
}
