import type { ShellState } from '../../shared/desktop-contracts.ts'
import { isToolkitComponentEnabled } from '../../shared/toolkit-components.ts'
import { loadAppSettings, loadSidebarVisibleProjectIds } from '../app-settings/readers.ts'
import { syncWorkspaceOrganization } from '../chat-state-db.ts'
import { getComposerState } from '../conversation-runtime.ts'
import { loadPiSettings, loadPiThemeState } from '../pi-settings.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { ensureConversationProjection } from './conversation-projection.ts'

export async function loadShellState(
  cwd: string,
  loadDirectories?: (cwd: string) => Promise<Pick<ShellState, 'resolvedCwd' | 'projects'>>,
): Promise<ShellState> {
  const agentDir = getAgentDirectory()
  await ensureConversationProjection()

  const appSettings = loadAppSettings()
  const codingEnabled = Boolean(loadDirectories) && isToolkitComponentEnabled(appSettings, 'coding')
  const [composer, piSettings, piTheme, directories] = await Promise.all([
    getComposerState(codingEnabled ? { projectId: cwd } : { composerMode: 'chat' }),
    loadPiSettings(codingEnabled ? cwd : null),
    loadPiThemeState(codingEnabled ? cwd : null),
    codingEnabled && loadDirectories ? loadDirectories(cwd) : { resolvedCwd: cwd, projects: [] },
  ])

  syncWorkspaceOrganization(
    directories.projects.map((project) => ({
      id: project.id,
      name: project.name,
      rootId: project.worktree?.rootProjectId ?? project.id,
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
    sidebarVisibleProjectIds: loadSidebarVisibleProjectIds(),
    piSettings,
    piTheme,
    composer,
  }
}
