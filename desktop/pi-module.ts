export type PiModule = typeof import('@earendil-works/pi-coding-agent')

import { loadAppSettings } from './app-settings/readers.ts'

let piModulePromise: Promise<PiModule> | undefined

function applyCustomPiDirectoryEnvironment() {
  const customPiDirectory = loadAppSettings().customPiDirectory?.trim()
  if (customPiDirectory) process.env['PI_CODING_AGENT_DIR'] = customPiDirectory
}

export function getPiModule() {
  if (!piModulePromise) {
    applyCustomPiDirectoryEnvironment()
    piModulePromise = import('@earendil-works/pi-coding-agent')
  }

  return piModulePromise
}
