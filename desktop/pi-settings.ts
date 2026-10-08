import { loadPiSettings } from './settings/preferences.ts'
import { loadThemeState } from './settings/themes.ts'

export { loadPiSettings, type PiSettingsKey, updatePiSetting } from './settings/preferences.ts'

export async function loadPiThemeState(directoryPath?: string | null) {
  return loadThemeState((await loadPiSettings(directoryPath)).theme, directoryPath)
}
