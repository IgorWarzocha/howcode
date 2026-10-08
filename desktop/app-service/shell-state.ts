import type { ShellState } from '../../shared/desktop-contracts.ts'
import { isToolkitComponentEnabled } from '../../shared/toolkit-components.ts'
import { loadAppSettings, loadSidebarVisibleDirectoryIds } from '../app-settings/readers.ts'
import { getComposerState } from '../conversation-runtime.ts'
import { loadPiSettings, loadPiThemeState } from '../pi-settings.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { syncWorkspaceOrganization } from '../workspace-repository.ts'
import { ensureConversationProjection } from './conversation-projection.ts'

export async function loadShellState(
  cwd: string,
  loadDirectories?: (cwd: string) => Promise<Pick<ShellState, 'resolvedCwd' | 'directories'>>,
): Promise<ShellState> {
  const agentDir = getAgentDirectory()
  await ensureConversationProjection()

  const appSettings = loadAppSettings()
  const codingEnabled = Boolean(loadDirectories) && isToolkitComponentEnabled(appSettings, 'coding')
  const [composer, piSettings, piTheme, directories] = await Promise.all([
    getComposerState(codingEnabled ? { directoryId: cwd } : { composerProfile: 'general' }),
    loadPiSettings(codingEnabled ? cwd : null),
    loadPiThemeState(codingEnabled ? cwd : null),
    codingEnabled && loadDirectories ? loadDirectories(cwd) : { resolvedCwd: cwd, directories: [] },
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
    piSettings,
    piTheme,
    composer,
  }
}
