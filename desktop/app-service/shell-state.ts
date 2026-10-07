import type { ShellState } from '../../shared/desktop-contracts.ts'
import { isToolkitComponentEnabled } from '../../shared/toolkit-components.ts'
import { loadAppSettings, loadSidebarVisibleProjectIds } from '../app-settings/readers.ts'
import { getComposerState } from '../conversation-runtime.ts'
import { loadPiSettings, loadPiThemeState } from '../pi-settings.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { ensureConversationProjection } from './conversation-projection.ts'

export async function loadShellState(
  cwd: string,
  loadWorkspace?: (cwd: string) => Promise<Pick<ShellState, 'resolvedCwd' | 'projects'>>,
): Promise<ShellState> {
  const agentDir = getAgentDirectory()
  await ensureConversationProjection()

  const appSettings = loadAppSettings()
  const codingEnabled = Boolean(loadWorkspace) && isToolkitComponentEnabled(appSettings, 'coding')
  const [composer, piSettings, piTheme, workspace] = await Promise.all([
    getComposerState(codingEnabled ? { projectId: cwd } : { composerMode: 'chat' }),
    loadPiSettings(codingEnabled ? cwd : null),
    loadPiThemeState(codingEnabled ? cwd : null),
    codingEnabled && loadWorkspace ? loadWorkspace(cwd) : { resolvedCwd: cwd, projects: [] },
  ])

  return {
    platform: process.platform,
    mockMode: false,
    productName: 'howcode',
    cwd,
    ...workspace,
    agentDir,
    appSettings,
    sidebarVisibleProjectIds: loadSidebarVisibleProjectIds(),
    piSettings,
    piTheme,
    composer,
  }
}
