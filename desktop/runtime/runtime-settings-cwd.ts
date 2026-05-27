import path from 'node:path'

export function normalizeRuntimeSettingsCwd(settingsCwd?: string | undefined | null | undefined) {
  return settingsCwd ? path.resolve(settingsCwd) : null
}
