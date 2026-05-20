export type PiModule = typeof import('@earendil-works/pi-coding-agent')

import { normalizeOptionalSettingsPath } from './app-settings/path-normalization.ts'
import { loadAppSettings } from './app-settings/readers.ts'

let piModulePromise: Promise<PiModule> | undefined

function setProcessEnvironmentVariable(name: string, value: string) {
  process.env[name] = value
}

function applyCustomPiDirectoryEnvironment() {
  const customPiDirectory = normalizeOptionalSettingsPath(loadAppSettings().customPiDirectory)
  if (customPiDirectory) setProcessEnvironmentVariable('PI_CODING_AGENT_DIR', customPiDirectory)
}

export function getPiModule() {
  if (!piModulePromise) {
    applyCustomPiDirectoryEnvironment()
    piModulePromise = import('@earendil-works/pi-coding-agent')
  }

  return piModulePromise
}
