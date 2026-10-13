import { loadShellPreferences } from './settings/preferences.ts'
import { loadThemeState } from './settings/themes.ts'

export {
  loadShellPreferences,
  type ShellPreferencesKey,
  updateShellPreference,
} from './settings/preferences.ts'

export async function loadPiThemeState(directoryPath?: string | null) {
  return loadThemeState((await loadShellPreferences(directoryPath)).theme, directoryPath)
}
