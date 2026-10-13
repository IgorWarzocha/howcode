import type { ShellState } from '../../shared/desktop-contracts.ts'
import { loadAppSettings, loadSidebarVisibleDirectoryIds } from '../app-settings/readers.ts'
import { getComposerState } from '../conversation-runtime.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { loadThemeState } from '../settings/themes.ts'
import { loadShellPreferences } from '../shell-preferences.ts'
import { syncWorkspaceOrganization } from '../workspace-repository.ts'
import { ensureConversationProjection } from './conversation-projection.ts'

export async function loadShellState(
  cwd: string,
  loadDirectories?: (cwd: string) => Promise<Pick<ShellState, 'resolvedCwd' | 'directories'>>,
): Promise<ShellState> {
  const agentDir = getAgentDirectory()
  await ensureConversationProjection()

  const appSettings = loadAppSettings()
  const directoryScopeAvailable = Boolean(loadDirectories)
  // Snapshot only previously registered scopes, before directory discovery seeds the current cwd.
  const shellPreferences = await loadShellPreferences(directoryScopeAvailable ? cwd : null)
  const [composer, piTheme, directories] = await Promise.all([
    getComposerState(
      directoryScopeAvailable ? { directoryId: cwd } : { composerProfile: 'general' },
    ),
    loadThemeState(shellPreferences.theme, directoryScopeAvailable ? cwd : null),
    directoryScopeAvailable && loadDirectories
      ? loadDirectories(cwd)
      : { resolvedCwd: cwd, directories: [] },
  ])

  syncWorkspaceOrganization(
    directories.directories.map((directory) => ({
      id: directory.id,
      name: directory.name,
      rootId: directory.worktree?.rootDirectoryId ?? directory.id,
    })),
  )

  return {
    platform: process.platform,
    mockMode: false,
    productName: 'howcode',
    cwd,
    ...directories,
    agentDir,
    appSettings,
    sidebarVisibleDirectoryIds: loadSidebarVisibleDirectoryIds(),
    shellPreferences,
    piTheme,
    composer,
  }
}
